from nautobot.apps.ui import NavMenuTab, NavMenuGroup, NavMenuItem

menu_items = (
    NavMenuTab(
        name="Topology",
        groups=(
            NavMenuGroup(
                name="Topology",
                items=(
                    NavMenuItem(
                        link="plugins:nautobot_topology:dashboard",
                        name="Topology Map",
                        permissions=["nautobot_topology.view_topologylayout"],
                    ),
                ),
            ),
        ),
    ),
)