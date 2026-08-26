# Campaigns and Permissions

Campaign settings are available from **Explorer → Settings → Campaign settings**. Access depends on the user's role and the campaign's player permissions.

## General settings

The **General** tab contains:

- campaign name;
- game system;
- campaign description;
- campaign deletion.

Choose **Save changes** after editing these fields. Only a game master can delete a campaign.

## Members and invitations

The **Who is playing** tab lists every member and their role.

1. Enter an optional display name and a required email address.
2. Choose **Invite**.
3. The recipient signs in or creates an account using that email address.
4. A game master can promote a member to game master, return them to player, or remove another member.

Use game-master access sparingly: game masters always have full access, including secrets and destructive actions.

## Player permissions

The **Permissions** tab applies to all players. Game masters always retain full access.

| Group      | Permission       | Allows players to…                                             |
| ---------- | ---------------- | -------------------------------------------------------------- |
| World      | Create nodes     | Add new nodes.                                                 |
| World      | Edit nodes       | Change node names, types, summaries, and shared descriptions.  |
| World      | Connect nodes    | Create and remove relationships.                               |
| World      | Delete           | Move nodes and sessions to trash.                              |
| World      | Add images       | Upload and replace node images and node maps.                  |
| Sessions   | Write sessions   | Edit shared session text and personal notes.                   |
| Sessions   | Start sessions   | Create new sessions.                                           |
| Sessions   | Restore versions | Open history and restore earlier node or session versions.     |
| Maps       | Upload maps      | Upload or replace the campaign map.                            |
| Maps       | Place markers    | Add, move, lock, unlock, and remove map markers.               |
| Secrets    | Reveal and hide  | Change node visibility.                                        |
| Secrets    | View secrets     | Receive hidden campaign content.                               |
| Secrets    | Read GM notes    | Read content reserved for game masters.                        |
| Management | Invite people    | Invite new campaign members.                                   |
| Management | Change settings  | Change campaign settings, graph forces, and custom node types. |

## Permission presets

- **Standard:** players can create, edit, link, add images, write, and use their normal visible world.
- **Open access:** enables every player permission.
- **Strict:** only shared writing is enabled.

After selecting a preset, review the individual switches and choose **Save permissions**.

## Node visibility

Each node can be:

- **Everyone:** available to all campaign members;
- **Selected players:** available only to selected players and game masters;
- **Only me:** private/secret; game masters retain access, and a private node created by a player is limited to that player.

Hidden nodes are filtered on the server, not merely hidden with CSS. A player cannot retrieve one by guessing its ID. Game masters see hidden nodes with a distinct ghost style in the graph.

## View as player

Game masters can use **Explorer → Settings → View** to inspect the campaign as a specific player. This mode is server-filtered and read-only. Return to **Game master** in the same selector before making changes.
