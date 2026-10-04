/**
 * The store name as a two-tone wordmark: the last word is shown in the
 * accent color ("Nimmis <Bling>"). A single-word name is shown plain.
 * Pure markup, so it works from both Server and Client Components.
 */
export function StoreWordmark({ name }: { name: string }) {
  const trimmed = name.trim();
  const splitAt = trimmed.lastIndexOf(" ");
  if (splitAt === -1) return <>{trimmed}</>;

  return (
    <>
      {trimmed.slice(0, splitAt)} <span className="text-primary">{trimmed.slice(splitAt + 1)}</span>
    </>
  );
}
