
import { Alert } from 'react-native';

export interface ConfirmItemDeletionOptions {
  itemName: string;
  onConfirm: () => void | Promise<void>;
}

export function confirmItemDeletion({
  itemName,
  onConfirm,
}: ConfirmItemDeletionOptions): void {
  Alert.alert(
    'Delete Item',
    `Delete "${itemName}" from your item catalog? Existing ledger entries will remain unchanged.`,
    [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          void Promise.resolve()
            .then(onConfirm)
            .catch((error) => {
              Alert.alert(
                'Delete Failed',
                error instanceof Error
                  ? error.message
                  : 'Unable to delete item.'
              );
            });
        },
      },
    ]
  );
}
