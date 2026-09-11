-- =====================================================================
-- De donde saca la IA el meta del juego
-- Ejecutar DESPUES de 024_entrenar.sql
-- =====================================================================
--
-- La busqueda web a secas devolvia granjas SEO con ejercitos de hace
-- meses. El meta real esta en Leyenda 1 y en esports, y lo cuentan cada
-- semana unos pocos creadores de YouTube y el blog de Blueprint. Aqui van
-- las fuentes, editables desde la pestaña Bots, y el digesto que la IA
-- lee (lo rehace /api/meta cada seis horas o a mano).
--
-- Canales verificados con la API de YouTube el 10 sep 2026.

insert into config (clave, valor, descripcion) values
  ('meta_canales', '[
      {"nombre": "Blueprint CoC",      "id": "UCQJJGSWnPUCb8uKV_MoJeOA"},
      {"nombre": "iTzu",               "id": "UCLKKvlo0yK8OgWvjCiZQ3sA"},
      {"nombre": "ShocK",              "id": "UCIMKOmtCOZv86cSPImRX7Mg"},
      {"nombre": "Applesauce",         "id": "UC1Vvz_7lccJF9bUzB810BTA"},
      {"nombre": "Clash With HABIBI",  "id": "UCwMPczpFS_-KUA9GkrqsNPA"},
      {"nombre": "Ace",                "id": "UCFi3w8g5RTXtfhvR1TNrGaw"},
      {"nombre": "Ace Esports",        "id": "UC9hAjXHELPN-cM7DCU4J0NQ"},
      {"nombre": "TK-Gamez",           "id": "UCuADBWs8AQbi9yK3brMElAg"}
    ]'::jsonb,
   'Canales de YouTube de los que la IA saca el meta (nombre e id de canal)'),
  ('meta_feeds', '[
      "https://blueprintcoc.com/blogs/town-hall-18.atom",
      "https://blueprintcoc.com/blogs/coc-legend-league.atom",
      "https://blueprintcoc.com/blogs/town-hall-17.atom"
    ]'::jsonb,
   'Feeds Atom/RSS con articulos de estrategia que la IA lee'),
  ('meta_webs', '["blueprintcoc.com", "clashofclans.com", "youtube.com", "reddit.com"]'::jsonb,
   'Dominios a los que se limita la busqueda web cuando preguntan por el meta')
on conflict (clave) do nothing;
