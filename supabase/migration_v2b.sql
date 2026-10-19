-- v2b: new service pages need three more service keys on the quote form.
alter table boatservice.quote_requests drop constraint if exists quote_requests_service_check;
alter table boatservice.quote_requests add constraint quote_requests_service_check check (service in ('engine_outboard','engine_inboard','winterizing','shrink_wrap',
  'commissioning','hull_fiberglass','electrical','bottom_paint','mobile_dockside','emergency_towing','detailing','storage','other'));
