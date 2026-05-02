from django.test import TestCase, Client
from unittest.mock import patch, MagicMock


class TopologyDashboardViewTest(TestCase):
    def setUp(self):
        self.client = Client()

    @patch("nautobot_topology.views.render")
    def test_get_dashboard(self, mock_render):
        # We simulate the render call since the template might require nautobot context
        mock_render.return_value = MagicMock(status_code=200)

        # Make request to the view directly since plugin URLs might not be fully loaded
        from nautobot_topology.views import TopologyDashboardView

        request = MagicMock()
        request.method = "GET"
        view = TopologyDashboardView.as_view()
        response = view(request)

        self.assertEqual(response.status_code, 200)
        mock_render.assert_called_once()
