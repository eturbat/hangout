// Reads server/.env into process.env. This is built into Node, so we don't
// need the dotenv package. A deployed host has no .env file and sets real
// environment variables instead, so a missing file is fine.
export function loadEnvFile(): void {
  try {
    process.loadEnvFile();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
  }
}
