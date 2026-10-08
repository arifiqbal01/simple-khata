
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
}

interface ConfirmState extends ConfirmOptions {
  visible: boolean;
}

const initialState: ConfirmState = {
  visible: false,
  title: '',
  message: '',
  confirmText: 'Confirm',
  cancelText: 'Cancel',
  destructive: false,
};

export function useConfirm() {
  const [state, setState] =
    useState<ConfirmState>(initialState);

  const [loading, setLoading] = useState(false);

  const resolverRef =
    useRef<((confirmed: boolean) => void) | null>(null);

  const confirm = useCallback(
    (options: ConfirmOptions): Promise<boolean> => {
      // Prevent overlapping confirmation dialogs.
      if (resolverRef.current) {
        return Promise.resolve(false);
      }

      return new Promise<boolean>((resolve) => {
        resolverRef.current = resolve;

        setLoading(false);
        setState({
          ...initialState,
          ...options,
          visible: true,
        });
      });
    },
    []
  );

  const settle = useCallback((result: boolean) => {
    const resolve = resolverRef.current;

    if (!resolve || loading) {
      return;
    }

    resolverRef.current = null;
    setState(initialState);
    resolve(result);
  }, [loading]);

  const handleConfirm = useCallback(() => {
    settle(true);
  }, [settle]);

  const handleCancel = useCallback(() => {
    settle(false);
  }, [settle]);

  useEffect(() => {
    return () => {
      // Avoid leaving a pending Promise when the screen unmounts.
      const resolve = resolverRef.current;
      resolverRef.current = null;
      resolve?.(false);
    };
  }, []);

  return {
    confirm,
    confirmProps: {
      ...state,
      loading,
      onConfirm: handleConfirm,
      onCancel: handleCancel,
    },
    setConfirmLoading: setLoading,
  };
}
