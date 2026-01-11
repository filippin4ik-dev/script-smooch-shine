// Type-only override to relax the typed backend client while schema types are empty.
// This does NOT change runtime behavior. It only widens types to unblock builds.
// When backend types are generated later, you can remove this file.

declare module "@/integrations/supabase/client" {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const supabase: any;
}
