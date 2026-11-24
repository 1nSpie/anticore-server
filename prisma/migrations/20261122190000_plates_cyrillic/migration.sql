-- Госномера российского формата, набранные латиницей (A123AA211), приводим к кириллице.
UPDATE "client_vehicles"
SET "plate" = translate("plate", 'ABEKMHOPCTYX', 'АВЕКМНОРСТУХ')
WHERE "plate" ~ '^[ABEKMHOPCTYX][0-9]{3}[ABEKMHOPCTYX]{2}[0-9]{2,3}$';
