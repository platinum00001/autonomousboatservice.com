-- v2c: cover the assigned_partner foreign keys (performance advisor).
create index if not exists quote_requests_assigned_partner_idx on boatservice.quote_requests (assigned_partner);
create index if not exists parts_requests_assigned_partner_idx on boatservice.parts_requests (assigned_partner);
