import { describe, expect, it } from "vitest";
import { contentCatalog, contentPieces } from "./catalog";

describe("contentCatalog", () => {
  it("finds the twinkle twinkle piece summary by dataName", () => {
    expect(contentCatalog.findPiece("traditional_twinkle_twinkle")).toEqual({
      dataName: "traditional_twinkle_twinkle",
      displayName: "Twinkle, Twinkle, Little Star",
      colorTheme: "sunset",
    });
  });

  it("finds the mary had a little lamb piece summary by dataName", () => {
    expect(
      contentCatalog.findPiece("traditional_mary_had_a_little_lamb"),
    ).toEqual({
      dataName: "traditional_mary_had_a_little_lamb",
      displayName: "Mary Had a Little Lamb",
      colorTheme: "forest",
    });
  });

  it("finds the ode to joy piece summary by dataName", () => {
    expect(contentCatalog.findPiece("beethoven_ode_to_joy")).toEqual({
      dataName: "beethoven_ode_to_joy",
      displayName: "Ode to Joy",
      colorTheme: "ocean",
    });
  });

  it("finds the moonlight sonata piece summary by dataName", () => {
    expect(contentCatalog.findPiece("beethoven_moonlight_sonata")).toEqual({
      dataName: "beethoven_moonlight_sonata",
      displayName: "Moonlight Sonata (Complete 1st Movement)",
      colorTheme: "parliament",
    });
  });

  it("finds the Moonlight Sonata 3rd movement piece summary by dataName", () => {
    expect(contentCatalog.findPiece("beethoven_moonlight_sonata_mov3")).toEqual(
      {
        dataName: "beethoven_moonlight_sonata_mov3",
        displayName: "Moonlight Sonata — 3rd Movement",
        colorTheme: "parliament",
      },
    );
  });

  it("finds the Für Elise piece summary by dataName", () => {
    expect(contentCatalog.findPiece("beethoven_fur_elise")).toEqual({
      dataName: "beethoven_fur_elise",
      displayName: "Für Elise",
      colorTheme: "parliament",
    });
  });

  it("finds the rachmaninoff prelude piece summary by dataName", () => {
    expect(contentCatalog.findPiece("rachmaninoff_prelude_op3_no2")).toEqual({
      dataName: "rachmaninoff_prelude_op3_no2",
      displayName: 'Prelude in C-sharp minor, Op. 3 No. 2 ("Bells of Moscow")',
      colorTheme: "midnight",
    });
  });

  it("finds the liszt la campanella piece summary by dataName", () => {
    expect(contentCatalog.findPiece("liszt_la_campanella")).toEqual({
      dataName: "liszt_la_campanella",
      displayName: "La Campanella (Grandes études de Paganini, S.141 No. 3)",
      colorTheme: "silver",
    });
  });

  it("finds the beethoven pathétique 1st movement piece summary by dataName", () => {
    expect(contentCatalog.findPiece("beethoven_pathetique_mov1")).toEqual({
      dataName: "beethoven_pathetique_mov1",
      displayName: 'Piano Sonata No. 8 "Pathétique", Op. 13 (1st Movement)',
      colorTheme: "crimson",
    });
  });

  it("finds the Chopin Fantaisie-Impromptu piece summary by dataName", () => {
    expect(contentCatalog.findPiece("chopin_fantaisie_impromptu")).toEqual({
      dataName: "chopin_fantaisie_impromptu",
      displayName: "Fantaisie-Impromptu, Op. 66",
      colorTheme: "amethyst",
    });
  });

  it("finds the Chopin Heroic Polonaise piece summary by dataName", () => {
    expect(contentCatalog.findPiece("chopin_heroic_polonaise_op53")).toEqual({
      dataName: "chopin_heroic_polonaise_op53",
      displayName: "Polonaise in A-flat major, Op. 53 (Heroic Polonaise)",
      colorTheme: "crimson",
    });
  });

  it("finds the Chopin Ballade No. 1 piece summary by dataName", () => {
    expect(contentCatalog.findPiece("chopin_ballade_no1_op23")).toEqual({
      dataName: "chopin_ballade_no1_op23",
      displayName: "Ballade No. 1 in G minor, Op. 23",
      colorTheme: "amethyst",
    });
  });

  it("finds the Chopin Nocturne Op. 9 No. 2 piece summary by dataName", () => {
    expect(contentCatalog.findPiece("chopin_nocturne_op9_no2")).toEqual({
      dataName: "chopin_nocturne_op9_no2",
      displayName: "Nocturne Op. 9 No. 2",
      colorTheme: "amethyst",
    });
  });

  it("finds the Chopin Minute Waltz piece summary by dataName", () => {
    expect(contentCatalog.findPiece("chopin_minute_waltz_op64_no1")).toEqual({
      dataName: "chopin_minute_waltz_op64_no1",
      displayName: "Minute Waltz Op. 64 No. 1",
      colorTheme: "amethyst",
    });
  });

  it("finds the Debussy Clair de lune piece summary by dataName", () => {
    expect(contentCatalog.findPiece("debussy_clair_de_lune")).toEqual({
      dataName: "debussy_clair_de_lune",
      displayName: "Clair de lune",
      colorTheme: "midnight",
    });
  });

  it("finds the Liszt Hungarian Rhapsody No. 2 piece summary by dataName", () => {
    expect(contentCatalog.findPiece("liszt_hungarian_rhapsody_no2")).toEqual({
      dataName: "liszt_hungarian_rhapsody_no2",
      displayName: "Hungarian Rhapsody No. 2",
      colorTheme: "silver",
    });
  });

  it("groups pieces into six composer packs including Debussy Impressionist Favorites", () => {
    expect(contentCatalog.packs).toHaveLength(6);
    expect(contentCatalog.packs[0]?.pieces).toHaveLength(2);
    expect(contentCatalog.packs[1]?.pieces).toHaveLength(5);
    expect(contentCatalog.packs[2]?.pieces).toHaveLength(1);
    expect(contentCatalog.packs[3]?.composerDisplay).toBe("Frédéric Chopin");
    expect(contentCatalog.packs[3]?.packDisplay).toBe("Romantic Favorites");
    expect(contentCatalog.packs[3]?.pieces).toHaveLength(5);
    expect(contentCatalog.packs[4]?.composerDisplay).toBe("Claude Debussy");
    expect(contentCatalog.packs[4]?.packDisplay).toBe(
      "Impressionist Favorites",
    );
    expect(contentCatalog.packs[4]?.pieces).toHaveLength(1);
    expect(contentCatalog.packs[5]?.pieces).toHaveLength(2);
    expect(
      contentCatalog.packs[5]?.pieces.filter(
        (piece) => piece.dataName === "liszt_hungarian_rhapsody_no2",
      ),
    ).toHaveLength(1);
  });
});

describe("contentPieces", () => {
  it("has the full twinkle twinkle piece with 42 chords", () => {
    const piece = contentPieces.get("traditional_twinkle_twinkle");
    expect(piece).toBeDefined();
    expect(piece?.chords).toHaveLength(42);
  });

  it("has the full mary had a little lamb piece with 26 chords", () => {
    const piece = contentPieces.get("traditional_mary_had_a_little_lamb");
    expect(piece).toBeDefined();
    expect(piece?.chords).toHaveLength(26);
  });

  it("has the full ode to joy piece with 30 chords", () => {
    const piece = contentPieces.get("beethoven_ode_to_joy");
    expect(piece).toBeDefined();
    expect(piece?.chords).toHaveLength(30);
  });

  it("has the full moonlight sonata piece with 821 chords, including multi-note chords", () => {
    const piece = contentPieces.get("beethoven_moonlight_sonata");
    expect(piece).toBeDefined();
    expect(piece?.chords).toHaveLength(821);
    expect(piece?.chords[0]?.notes.length).toBeGreaterThan(1);
  });

  it("has the full rachmaninoff prelude piece with 550 chords, including multi-note chords", () => {
    const piece = contentPieces.get("rachmaninoff_prelude_op3_no2");
    expect(piece).toBeDefined();
    expect(piece?.chords).toHaveLength(550);
    expect(piece?.chords[0]?.notes.length).toBeGreaterThan(1);
  });

  it("has the full liszt la campanella piece with 2329 chords", () => {
    const piece = contentPieces.get("liszt_la_campanella");
    expect(piece).toBeDefined();
    expect(piece?.chords).toHaveLength(2329);
  });

  it("has the full beethoven pathétique 1st movement piece with 3075 chords, including multi-note chords", () => {
    const piece = contentPieces.get("beethoven_pathetique_mov1");
    expect(piece).toBeDefined();
    expect(piece?.chords).toHaveLength(3075);
    expect(piece?.chords[0]?.notes.length).toBeGreaterThan(1);
  });

  it("has the full Chopin Fantaisie-Impromptu piece with 2561 chords", () => {
    const piece = contentPieces.get("chopin_fantaisie_impromptu");
    expect(piece).toBeDefined();
    expect(piece?.chords).toHaveLength(2561);
  });

  it("has the full Chopin Heroic Polonaise performance with 2214 chords", () => {
    const piece = contentPieces.get("chopin_heroic_polonaise_op53");
    expect(piece).toBeDefined();
    expect(piece?.chords).toHaveLength(2214);
  });

  it("has the complete Chopin Ballade No. 1 performance with 2571 chords", () => {
    const piece = contentPieces.get("chopin_ballade_no1_op23");
    expect(piece).toBeDefined();
    expect(piece?.chords).toHaveLength(2571);
  });

  it("has the full Chopin Nocturne Op. 9 No. 2 performance with 627 chords", () => {
    const piece = contentPieces.get("chopin_nocturne_op9_no2");
    expect(piece).toBeDefined();
    expect(piece?.chords).toHaveLength(627);
  });

  it("has the full Chopin Minute Waltz performance with 1217 chords", () => {
    const piece = contentPieces.get("chopin_minute_waltz_op64_no1");
    expect(piece).toBeDefined();
    expect(piece?.chords).toHaveLength(1217);
  });

  it("has the full Liszt Hungarian Rhapsody No. 2 performance with 3261 chords", () => {
    const piece = contentPieces.get("liszt_hungarian_rhapsody_no2");
    expect(piece).toBeDefined();
    expect(piece?.chords).toHaveLength(3261);
  });

  it("has the full Debussy Clair de lune performance with 815 chords", () => {
    const piece = contentPieces.get("debussy_clair_de_lune");
    expect(piece).toBeDefined();
    expect(piece?.chords).toHaveLength(815);
  });

  it("has the complete Moonlight Sonata 3rd movement performance with 3781 chords", () => {
    const piece = contentPieces.get("beethoven_moonlight_sonata_mov3");
    expect(piece).toBeDefined();
    expect(piece?.chords).toHaveLength(3781);
  });

  it("has the complete Für Elise performance with 785 chords", () => {
    const piece = contentPieces.get("beethoven_fur_elise");
    expect(piece).toBeDefined();
    expect(piece?.chords).toHaveLength(785);
  });
});
