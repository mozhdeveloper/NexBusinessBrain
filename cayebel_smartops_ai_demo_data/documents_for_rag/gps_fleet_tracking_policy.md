# GPS and Fleet Tracking Integration Policy

Purpose:
To monitor mobile equipment, service vehicles, and field units.

Tracked data:
- Location
- Engine hours
- Movement status
- Idle time
- Service usage threshold
- Device signal status

Service due logic:
If mobile equipment reaches 1000 engine hours, the system should recommend PMS.
If GPS device is offline for more than 24 hours, operations team should verify device status.
If equipment has high usage and no recent PMS record, mark as service risk.

Client benefit:
- Better visibility of equipment location
- Faster service planning
- Reduced downtime
- PMS based on real usage, not guesswork
