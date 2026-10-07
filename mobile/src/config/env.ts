const apiUrl = process.env.EXPO_PUBLIC_API_URL;

if (!apiUrl) {
  throw new Error(
    "EXPO_PUBLIC_API_URL environment variable is not configured"
  );
}

export const env = {
  apiUrl,
} as const;