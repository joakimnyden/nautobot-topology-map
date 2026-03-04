from rest_framework.viewsets import ViewSet
from rest_framework.response import Response
from nautobot.dcim.models import Device
from .serializers import DeviceSerializer

class TopologyViewSet(ViewSet):
    def list(self, request):
        from nautobot.dcim.models import Site, Device, Cable
        from django.db.models import Count
        import random

        # Fetch sites, prefetching necessary related data
        sites = Site.objects.all()
        sites_data = []

        for site in sites:
            # Safely get coordinates, using defaults if they don't exist securely 
            # (Nautobot's model fields can vary slightly by version, but latitude/longitude are standard).
            lat = float(site.latitude) if getattr(site, 'latitude', None) else None
            lng = float(site.longitude) if getattr(site, 'longitude', None) else None
            
            # If a site has no coordinates, we might skip it or assign mock ones for demonstration
            # but ideally we only show sites with coordinates.
            if lat is None or lng is None:
                continue

            device_count = Device.objects.filter(site=site).count()
            
            # To get link counts, we'd look at cables, but for now we can mock it or calculate an approximate
            # if we don't want to do complex endpoint queries.
            link_count = random.randint(1, 10) # Mocked link count for now

            region_name = site.region.name if getattr(site, 'region', None) else "Global"
            country = "Unknown"
            
            # Nautobot 1.x had `region`, Nautobot 2.x+ has `locations`. 
            # We will use what's available or default to "Unknown" 

            sites_data.append({
                "id": str(site.id),
                "name": site.name,
                "coordinates": [lng, lat],
                "deviceCount": device_count,
                "linkCount": link_count,
                "region": region_name,
                "country": country,
                "status": "Active" # Mock status
            })

        return Response({
            "status": "success",
            "data": {
                "nodes": sites_data,
                "links": []
            }
        })
