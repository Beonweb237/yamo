-- Yamo — traçabilité des décisions admin sur les livreurs :
-- motif de suspension et motif de refus de virement.

alter table profiles add column suspension_reason text;
alter table payout_requests add column processed_reason text;
