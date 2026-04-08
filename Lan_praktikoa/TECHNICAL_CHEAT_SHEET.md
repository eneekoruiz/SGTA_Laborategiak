# SimHiri — Technical Cheat Sheet

1. The city does not update by script; it advances through a deterministic monthly simulation core that recalculates demand, growth, utilities, economy, and defeat conditions in one pass.
2. Power, water, and road access are not visual flags; they propagate through the map with a BFS utility grid, which makes infrastructure behave like a connected system.
3. The isometric renderer is optimized for 60 FPS by separating static terrain, dynamic entities, and interaction overlays into layered canvas passes.
4. The canvas pipeline scales to Retina and 4K displays by matching the drawing buffer to `devicePixelRatio`, so tiles and edges stay crisp instead of blurry.
5. The AI rival is not a dummy opponent; it uses the same monthly engine as the player city, so its population, treasury, and collapse conditions evolve realistically.
6. Ordinances are not cosmetic toggles; they feed into the simulation as stacked modifiers that can increase crime, reduce pollution, or reshape RCI demand.
7. Disaster damage creates persistent ruin states, which means destruction is a gameplay object and not just a temporary effect.
8. The Bulldozer is part of the simulation loop, not just a UI tool, because it is required to clear ruins before rebuilding can resume.
9. The QA harness uses deterministic mock state and a 24-month sweep, which proves the system against repeatable evidence instead of one-off manual testing.
10. Every visible HUD value is backed by store synchronization, so the interface refreshes immediately after endMonth and reflects the same authoritative state as the simulation.
