-- Seed waste classes with their exact Average Emission Factors
INSERT INTO waste_emission_factors (id, display_name, avg_emission_factor, description) VALUES
('metal',        'Metal',                2.365000, 'Scrap, foil, packaging, and container metals'),
('organic',      'Organic Waste',        0.280000, 'Food scraps, peelings, and compostable organic waste'),
('paper',        'Paper & Cardboard',    1.495000, 'Mixed paper, cardboard packaging, and newsprint'),
('plastic_low',  'Plastic (Low Impact)', 1.695000, 'Low-density/recycled consumer plastics'),
('plastic_mid',  'Plastic (Mid Impact)', 3.580000, 'Standard rigid plastics, bottles, and containers'),
('plastic_high', 'Plastic (High Impact)',5.680000, 'High-density, multi-layer, or composite plastics'),
('wood',         'Wood Products',        0.377915, 'Treated or untreated wood scraps and timber')
ON CONFLICT (id) DO UPDATE 
SET display_name = EXCLUDED.display_name,
    avg_emission_factor = EXCLUDED.avg_emission_factor,
    description = EXCLUDED.description;
