# Getting Started

This guide takes a new Atlore user from the first sign-in to a usable campaign.

## 1. Open Atlore

If someone else hosts Atlore, open the URL they provided. When self-hosting locally, follow [Self-hosting and Configuration](https://github.com/jellesiderius/atlore/wiki/Self-hosting-and-Configuration) and then open `http://localhost:3000`.

## 2. Create an account or sign in

1. Choose **Sign up** to create an account, or **Sign in** if you already have one.
2. Enter your name, email address, and a password of at least 10 characters.
3. If you received a campaign invitation, sign in with the invited email address and accept the invitation.

For a seeded local installation, these demo accounts are available:

- `demo@atlore.app` / `AtloreDemo!2026` — game master
- `lena@atlore.app` / `AtloreDemo!2026` — player

Never expose the demo passwords on a public installation.

## 3. Set your language and appearance

1. Open the round account button in the campaign overview.
2. Under **Preferences**, choose **Dark** or **Light**.
3. Select **NL** or **EN** under **Language**.
4. Optionally update your name, email address, and profile colour.

These preferences belong to your account/browser and do not change the campaign for other users.

## 4. Create your first campaign

1. On the campaign overview, choose **New campaign**.
2. Enter a campaign name.
3. Choose or enter the game system.
4. Add a short description so invited players know what the world is about.
5. Choose **Begin**.

The creator becomes a game master and always has full campaign access.

## 5. Add the first nodes

1. Open **Graph** in the main navigation.
2. Use the **+** button in the Explorer, or double-click an empty area of the graph.
3. Enter a name and select a node type.
4. Set visibility to **Everyone**, **Selected players**, or **Only me**.
5. Optionally connect the new node directly to existing nodes.
6. Open the node dossier to add a summary, shared description, personal notes, image, relationships, or a map.

Good first nodes are the player characters, the opening location, an important NPC, and the first quest.

## 6. Start a session

1. Open **Session** in the main navigation.
2. Choose **Start session**.
3. Enter a session title and an in-world date.
4. Write together in the shared editor.
5. Type `@` followed by a node name to link it in the text.
6. Use **New: “name”** when the entity does not exist yet.
7. Review the suggested relationships below the editor and connect the relevant pairs.

Shared text saves automatically. Personal session notes are visible only to their author.

## 7. Invite players

1. Open **Settings** in the Explorer.
2. Choose **Campaign settings**.
3. Open **Who is playing**.
4. Enter a name if desired and the player's email address.
5. Send the invitation.
6. Open **Permissions** and choose a preset or configure individual player rights.

If SMTP is not configured on a self-hosted installation, inspect the application logs for the development email output.

## Recommended next steps

- Learn the four main views in [Interface Overview](https://github.com/jellesiderius/atlore/wiki/Interface-Overview).
- Understand secrets and player access in [Campaigns and Permissions](https://github.com/jellesiderius/atlore/wiki/Campaigns-and-Permissions).
- Learn graph dragging and linking in [Nodes and Graph](https://github.com/jellesiderius/atlore/wiki/Nodes-and-Graph).
- Upload a campaign map using [Maps and Media](https://github.com/jellesiderius/atlore/wiki/Maps-and-Media).
