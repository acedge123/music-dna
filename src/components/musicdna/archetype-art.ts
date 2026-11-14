import believer from "@/assets/archetypes/believer.jpg.asset.json";
import atmospherist from "@/assets/archetypes/atmospherist.jpg.asset.json";
import romantic from "@/assets/archetypes/romantic.jpg.asset.json";
import anthemist from "@/assets/archetypes/anthemist.jpg.asset.json";
import transformer from "@/assets/archetypes/transformer.jpg.asset.json";
import hedonist from "@/assets/archetypes/hedonist.jpg.asset.json";
import witness from "@/assets/archetypes/witness.jpg.asset.json";

const ART: Record<string, string> = { believer: believer.url, atmospherist: atmospherist.url, romantic: romantic.url, anthemist: anthemist.url, transformer: transformer.url, hedonist: hedonist.url, witness: witness.url };

export function archetypeArt(name?: string | null): string | null {
  if (!name) return null;
  return ART[name.toLowerCase().replace(/^the\s+/, "").trim()] ?? null;
}
