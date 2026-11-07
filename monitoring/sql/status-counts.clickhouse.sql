select source, count() as events,
  countIf(status between 100 and 599) as responses,
  countIf(status between 500 and 599) as server_errors,
  countIf(status in (401,403)) as access_failures,
  countIf(status is null or status < 100 or status > 599) as unknown_status
from (
  select source,
    toInt32OrNull(if(source='edge_logs',log_attributes['response.status_code'],log_attributes['status'])) as status
  from logs where source in ('edge_logs','auth_logs','function_edge_logs')
)
group by source order by source limit 3
