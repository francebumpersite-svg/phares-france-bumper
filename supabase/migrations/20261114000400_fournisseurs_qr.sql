-- En Chine les fournisseurs donnent rarement leur numéro : on garde la photo de leur QR code WeChat
alter table public.fournisseurs add column if not exists wechat_qr text;

-- Les catalogues sont souvent donnés par QR code : photo du QR + lien lu automatiquement
alter table public.fournisseurs add column if not exists catalogue_qr text;
alter table public.fournisseurs add column if not exists catalogue_lien text;
