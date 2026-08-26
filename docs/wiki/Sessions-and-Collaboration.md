# Sessions and Collaboration

Sessions combine a shared campaign report with each user's private scratchpad.

## Start a session

1. Open **Session** in the main navigation.
2. Choose **Start session**.
3. Enter a title and optional in-world date.
4. Begin writing in the shared editor.

Only users with **Start sessions** permission can create one. Users with **Write sessions** permission can edit existing sessions.

## Link nodes with `@`

1. Type `@` and continue with part of a node name.
2. Select a matching existing node.
3. If no exact node exists, choose **New: “name”** to create it and insert the link.
4. Click a node chip to open its dossier.
5. Right-click a node chip for actions such as open, connect, show in graph, or detach from text.

Atlore stores node references by ID but always displays the current node name, including in version history.

## Automatic relationship suggestions

When multiple nodes appear together in a session, Atlore can suggest missing graph relationships below the editor.

- Select one pair to connect only those nodes.
- Choose **All** to connect every displayed pair.
- Ignore a pair when co-occurrence does not imply a meaningful relationship.

The graph updates immediately after connections are added; a hard refresh is not required.

## Shared and private writing

- **Shared session text:** visible to permitted campaign members and synchronized in realtime.
- **Personal session notes:** visible only to the current user.
- **Node shared description:** global campaign information, synchronized in realtime.
- **Node personal notes:** visible only to their author.

Editors preserve paragraph breaks and save after a short pause. Navigating away flushes pending changes.

## Realtime collaboration

When two users open the same shared session or node description:

- text updates appear without reloading;
- the other user's coloured cursor appears in the editor;
- a status line identifies who last updated the content;
- committed changes invalidate and refresh graph, session, story, and atlas data through Redis and WebSockets.

If the socket disconnects, saved HTTP updates still work. See [Troubleshooting](https://github.com/jellesiderius/atlore/wiki/Troubleshooting) when realtime updates do not return after reconnecting.

## Story view

Open **Story** to read all active sessions as one continuous campaign narrative. Session titles, dates, paragraphs, and node chips stay linked to their source data.

## History and restore

Users with **Restore versions** permission can open the clock button for a node or session.

1. Select an earlier version.
2. Review the displayed changes.
3. Choose **Restore**.

Restoring creates a new current version; it does not erase the history that came after the selected version.

## Delete or restore a session

Move a session to trash from the Session toolbar. Restore or permanently delete it under **Explorer → Settings → Trash**.
