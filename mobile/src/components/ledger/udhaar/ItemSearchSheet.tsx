
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  ActivityIndicator,
  Keyboard,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  View,
} from 'react-native';

import { Ionicons } from '@expo/vector-icons';

import {
  AppText,
  IconButton,
  SearchField,
} from '@/components/ui';

import type { Item } from '@/types/domain';
import type { QuickItem } from '@/services/item/get-quick-items';

import { SearchItemsService } from '@/services/item/search';
import { ItemRepository } from '@/repositories/item/item';
import { normalizeName } from '@/hooks/ledger/udhaar/utils';

const SEARCH_LIMIT = 50;
const QUICK_LIMIT = 5;

const itemRepository = new ItemRepository();
const searchService = new SearchItemsService(itemRepository);

export interface ItemSearchSheetProps {
  visible: boolean;
  shopId: string | null;
  quickItems: QuickItem[];
  selectedItemIds: string[];
  onClose: () => void;
  onSelectItem: (item: Item) => void;
  onCreateNew: (name: string) => void;
}

export const ItemSearchSheet = memo(
  function ItemSearchSheet({
    visible,
    shopId,
    quickItems,
    selectedItemIds,
    onClose,
    onSelectItem,
    onCreateNew,
  }: ItemSearchSheetProps) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<Item[]>([]);
    const [quickResults, setQuickResults] = useState<Item[]>([]);
    const [exactMatch, setExactMatch] = useState<Item | null>(null);

    const [loadingSearch, setLoadingSearch] = useState(false);
    const [loadingQuick, setLoadingQuick] = useState(false);
    const [checkingExact, setCheckingExact] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const searchRequest = useRef(0);
    const quickRequest = useRef(0);
    const exactRequest = useRef(0);

    const trimmedQuery = query.trim();
    const normalizedQuery = normalizeName(trimmedQuery);

    const selectedSet = useMemo(
      () => new Set(selectedItemIds),
      [selectedItemIds]
    );

    const closeSheet = useCallback(() => {
      searchRequest.current += 1;
      quickRequest.current += 1;
      exactRequest.current += 1;

      Keyboard.dismiss();
      onClose();
    }, [onClose]);

    useEffect(() => {
      if (!visible) {
        searchRequest.current += 1;
        quickRequest.current += 1;
        exactRequest.current += 1;
        return;
      }

      setQuery('');
      setResults([]);
      setQuickResults([]);
      setExactMatch(null);
      setError(null);
      setLoadingSearch(false);
      setLoadingQuick(false);
      setCheckingExact(false);
    }, [visible]);

    /*
     * Resolve most-used items by their IDs.
     * This does not depend on the first page
     * of the catalog.
     */
    useEffect(() => {
      const request = ++quickRequest.current;

      if (!visible || !shopId) {
        setQuickResults([]);
        setLoadingQuick(false);
        return;
      }

      const ids = quickItems
        .map((item) => item.id)
        .filter(
          (id): id is string =>
            typeof id === 'string' && id.length > 0
        );

      if (ids.length === 0) {
        setQuickResults([]);
        setLoadingQuick(false);
        return;
      }

      setLoadingQuick(true);

      void itemRepository
        .getManyByIds(shopId, ids)
        .then((items) => {
          if (request !== quickRequest.current) {
            return;
          }

          const byId = new Map(
            items
              .filter((item) => item.deleted_at == null)
              .map((item) => [item.id, item])
          );

          const ordered: Item[] = [];
          const seen = new Set<string>();

          for (const quickItem of quickItems) {
            if (!quickItem.id || seen.has(quickItem.id)) {
              continue;
            }

            const item = byId.get(quickItem.id);

            if (item) {
              seen.add(item.id);
              ordered.push(item);
            }

            if (ordered.length >= QUICK_LIMIT) {
              break;
            }
          }

          setQuickResults(ordered);
        })
        .catch((cause: unknown) => {
          if (request !== quickRequest.current) {
            return;
          }

          console.warn(
            '[ItemSearchSheet] Unable to load most-used items',
            cause
          );

          setQuickResults([]);
        })
        .finally(() => {
          if (request === quickRequest.current) {
            setLoadingQuick(false);
          }
        });

      return () => {
        quickRequest.current += 1;
      };
    }, [visible, shopId, quickItems]);

    /*
     * SQLite search is already ranked:
     * exact match, prefix match, substring match.
     */
    useEffect(() => {
      const request = ++searchRequest.current;

      setResults([]);
      setError(null);

      if (!visible || !shopId || !trimmedQuery) {
        setLoadingSearch(false);
        return;
      }

      setLoadingSearch(true);

      const timeout = setTimeout(() => {
        void searchService
          .execute({
            shopId,
            query: trimmedQuery,
            limit: SEARCH_LIMIT,
            offset: 0,
          })
          .then((items) => {
            if (request === searchRequest.current) {
              setResults(items);
            }
          })
          .catch((cause: unknown) => {
            if (request !== searchRequest.current) {
              return;
            }

            console.warn(
              '[ItemSearchSheet] Search failed',
              cause
            );

            setError('Unable to search items. Please try again.');
          })
          .finally(() => {
            if (request === searchRequest.current) {
              setLoadingSearch(false);
            }
          });
      }, 180);

      return () => {
        clearTimeout(timeout);
        searchRequest.current += 1;
      };
    }, [visible, shopId, trimmedQuery]);

    /*
     * Exact-name lookup prevents creating an
     * item already present in the catalog.
     */
    useEffect(() => {
      const request = ++exactRequest.current;

      setExactMatch(null);

      if (!visible || !shopId || !trimmedQuery) {
        setCheckingExact(false);
        return;
      }

      setCheckingExact(true);

      void itemRepository
        .getByNameAndShop(shopId, trimmedQuery)
        .then((item) => {
          if (request === exactRequest.current) {
            setExactMatch(item?.deleted_at == null ? item : null);
          }
        })
        .catch((cause: unknown) => {
          if (request !== exactRequest.current) {
            return;
          }

          console.warn(
            '[ItemSearchSheet] Exact-name lookup failed',
            cause
          );

          setError('Unable to verify item name. Please try again.');
        })
        .finally(() => {
          if (request === exactRequest.current) {
            setCheckingExact(false);
          }
        });

      return () => {
        exactRequest.current += 1;
      };
    }, [visible, shopId, trimmedQuery]);

    const suggestions = useMemo(() => {
      const source = trimmedQuery ? results : quickResults;
      const seen = new Set<string>();

      return source.filter((item) => {
        if (
          item.deleted_at != null ||
          selectedSet.has(item.id) ||
          seen.has(item.id)
        ) {
          return false;
        }

        seen.add(item.id);
        return true;
      });
    }, [trimmedQuery, results, quickResults, selectedSet]);

    const exactAlreadySelected =
      exactMatch !== null && selectedSet.has(exactMatch.id);

    const canCreate =
      normalizedQuery.length > 0 &&
      normalizedQuery.length <= 150 &&
      !loadingSearch &&
      !checkingExact &&
      !error &&
      exactMatch === null;

    const handleSelect = useCallback(
      (item: Item) => {
        Keyboard.dismiss();
        onSelectItem(item);
        onClose();
      },
      [onSelectItem, onClose]
    );

    const handleCreate = useCallback(() => {
      if (!canCreate) {
        return;
      }

      Keyboard.dismiss();
      onCreateNew(trimmedQuery);
    }, [canCreate, trimmedQuery, onCreateNew]);

    const panResponder = useMemo(
      () =>
        PanResponder.create({
          onMoveShouldSetPanResponder: (_, gesture) =>
            gesture.dy > 12 &&
            Math.abs(gesture.dy) > Math.abs(gesture.dx),

          onPanResponderRelease: (_, gesture) => {
            if (gesture.dy > 70 || gesture.vy > 1.1) {
              closeSheet();
            }
          },
        }),
      [closeSheet]
    );

    const loading = trimmedQuery
      ? loadingSearch || checkingExact
      : loadingQuick;

    return (
      <Modal
        visible={visible}
        transparent
        animationType="slide"
        statusBarTranslucent
        onRequestClose={closeSheet}
      >
        <View className="flex-1 justify-end">
          <Pressable
            className="absolute inset-0 bg-black/40"
            onPress={closeSheet}
            accessibilityRole="button"
            accessibilityLabel="Close item search"
          />

          <View className="max-h-[85%] rounded-t-3xl bg-background px-5 pb-8 pt-3">
            <View
              {...panResponder.panHandlers}
              className="items-center pb-4"
            >
              <View className="h-1.5 w-12 rounded-full bg-border-strong" />
            </View>

            <View className="mb-4 flex-row items-center justify-between">
              <AppText variant="heading">
                Add item
              </AppText>

              <IconButton
                onPress={closeSheet}
                accessibilityLabel="Close item search"
              >
                <Ionicons
                  name="close"
                  size={22}
                  color="#777770"
                />
              </IconButton>
            </View>

            <SearchField
              value={query}
              onChangeText={setQuery}
              placeholder="Search or enter item"
              accessibilityLabel="Search items"
              autoCapitalize="words"
            />

            <ScrollView
              className="mt-4"
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              {!trimmedQuery && (
                <AppText variant="caption" className="mb-2">
                  Most used items
                </AppText>
              )}

              {loading ? (
                <View className="items-center py-8">
                  <ActivityIndicator color="#181816" />
                </View>
              ) : (
                <>
                  {suggestions.map((item, index) => (
                    <Pressable
                      key={item.id}
                      onPress={() => handleSelect(item)}
                      accessibilityRole="button"
                      accessibilityLabel={`Select ${item.name}`}
                      className={`flex-row items-center justify-between py-4 ${
                        index < suggestions.length - 1
                          ? 'border-b border-border'
                          : ''
                      }`}
                    >
                      <View className="min-w-0 flex-1">
                        <AppText
                          variant="bodyMedium"
                          numberOfLines={1}
                        >
                          {item.name}
                        </AppText>

                        {(item.default_unit ||
                          item.default_selling_price != null) && (
                          <AppText
                            variant="caption"
                            className="mt-1"
                          >
                            {[
                              item.default_unit,
                              item.default_selling_price != null
                                ? `Rs ${item.default_selling_price}`
                                : null,
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </AppText>
                        )}
                      </View>

                      <Ionicons
                        name="add-circle-outline"
                        size={22}
                        color="#777770"
                      />
                    </Pressable>
                  ))}

                  {suggestions.length === 0 && !error && (
                    <AppText
                      variant="small"
                      className="py-6 text-center"
                    >
                      {trimmedQuery
                        ? exactAlreadySelected
                          ? 'This item is already selected.'
                          : 'No matching items'
                        : 'No frequently used items yet'}
                    </AppText>
                  )}

                  {error && (
                    <AppText
                      variant="caption"
                      className="py-4 text-center text-udhaar"
                    >
                      {error}
                    </AppText>
                  )}

                  {exactMatch &&
                    !selectedSet.has(exactMatch.id) &&
                    !suggestions.some(
                      (item) => item.id === exactMatch.id
                    ) && (
                      <Pressable
                        onPress={() => handleSelect(exactMatch)}
                        accessibilityRole="button"
                        accessibilityLabel={`Select ${exactMatch.name}`}
                        className="mt-2 flex-row items-center justify-between rounded-control bg-surface px-4 py-4"
                      >
                        <AppText variant="bodyMedium">
                          {exactMatch.name}
                        </AppText>

                        <Ionicons
                          name="add-circle-outline"
                          size={22}
                          color="#777770"
                        />
                      </Pressable>
                    )}

                  {canCreate && (
                    <Pressable
                      onPress={handleCreate}
                      accessibilityRole="button"
                      accessibilityLabel={`Create new item ${trimmedQuery}`}
                      className="mt-3 flex-row items-center rounded-control border border-border bg-surface px-4 py-4"
                    >
                      <Ionicons
                        name="add-circle-outline"
                        size={22}
                        color="#181816"
                      />

                      <View className="ml-3 min-w-0 flex-1">
                        <AppText variant="bodyMedium">
                          Add new item
                        </AppText>

                        <AppText
                          variant="caption"
                          numberOfLines={1}
                          className="mt-1"
                        >
                          {trimmedQuery}
                        </AppText>
                      </View>

                      <Ionicons
                        name="chevron-forward"
                        size={18}
                        color="#777770"
                      />
                    </Pressable>
                  )}
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    );
  }
);
