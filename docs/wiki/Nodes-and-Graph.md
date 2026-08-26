# Nodes and Graph

Nodes are the building blocks of an Atlore world. Relationships between them form the campaign graph.

## Built-in node types

Atlore includes characters, NPCs, locations, buildings, regions, factions, quests, items, monsters, lore, and deities. Campaign managers can add custom types under **Explorer → Settings** and assign colours for dark and light mode.

## Create a node

You can create a node in three ways:

1. Use the **+** button in the Explorer.
2. Double-click empty graph space to create it at that position.
3. Type `@name` in a shared editor and choose **New: “name”**.

In the `@` menu, Atlore offers an exact existing node instead of creating a duplicate with the same name.

The creation form supports a name, type, visibility, selected players, and one or more immediate relationships.

## Open and edit a dossier

- Double-click a node in the graph.
- Click a node twice in the Explorer.
- Choose **Open** from a node context menu or popup.
- Click an `@` node chip in a text editor or reading view.

The dossier contains:

- **Overview:** image, type, visibility, summary, shared description, and personal notes;
- **Map:** a dedicated map for locations, buildings, and regions;
- **Relations:** current relationships, connection search, and sessions that mention the node;
- **Story:** session excerpts in which the node appears.

Shared descriptions save automatically and synchronize with other active users. Personal notes save automatically but remain private to their author.

## Create relationships

- Open **Relations** in a dossier and search for another node.
- Choose **Connect to…** from a right-click context menu.
- Select relationships suggested below a session after mentioning multiple nodes.
- Choose **Connect all** only when every suggested relationship is meaningful.

Removing a relationship does not delete either node or remove its `@` mentions from text.

## Navigate the graph

- Click a node to select it and open its compact popup.
- Click an Explorer result to move smoothly to that node.
- Drag empty space to pan.
- Scroll to zoom.
- Use **Fit all** to bring all active nodes into view.
- Use **Rearrange graph** to calculate a new layout.

## Connected swarm dragging

Dragging one node also influences every transitively connected node. Direct neighbours react most strongly; more distant nodes follow with a softer force. During the drag, Atlore highlights the connected group and dims unrelated content to create focus.

The position of the node you drag is saved to the campaign. Nodes marked as pinned in imported or seeded data keep their position during layout calculations.

## Graph force settings

Open **Explorer → Settings** to configure campaign-wide graph behaviour:

- **Repulsion:** how strongly nodes push away from each other;
- **Link length:** the preferred distance between connected nodes;
- **Grouping:** how strongly related communities cluster;
- **Centre:** how strongly the graph stays around its centre.

Changes save automatically to the campaign and update connected users. Use **Rearrange graph** after large changes when you want a completely fresh layout.

## Trash and restoration

Choose **Move to trash** from a node context menu. Restore or permanently delete items under **Explorer → Settings → Trash**. Permanent deletion cannot be undone.
