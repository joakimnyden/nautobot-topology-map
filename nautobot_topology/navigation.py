from nautobot.apps.ui import NavMenuTab, NavMenuSection, NavMenuItem

menu_items = (
    NavMenuTab(
        name="Nexus",
        groups=(
            NavMenuSection(
                name="Topology",
                items=(
                    NavMenuItem(
                        link="plugins:nautobot_topology:dashboard",
                        name="Topology Map",
                        permissions=["nautobot_topology.view_topology"],
                    ),
                ),
            ),
        ),
    ),
)
