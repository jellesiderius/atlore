# Maps and Media

Atlore supports a main campaign map, maps attached to place nodes, node images, and draggable node markers.

## Supported uploads

Image inputs accept the formats configured by the application, with a default maximum size of 12 MB. A self-hosting administrator can change the limit with `MAX_UPLOAD_MB`.

You can select a file with the upload control or drag an image directly onto the relevant image or map area.

## Upload the campaign map

1. Open **Map** in the main navigation.
2. Choose **Upload map**, or drag an image onto the empty atlas.
3. Replace an existing map using the upload button in the atlas toolbar.
4. Use the fit control, zoom buttons, mouse wheel, and drag-to-pan controls to navigate.

Uploading the campaign map requires **Upload maps** permission.

## Add a map to a place node

Location, building, and region nodes have a **Map** dossier tab.

1. Open the place node dossier.
2. Open **Map**.
3. Upload or drop the map image.
4. Open the main **Map** view and select this node's map from the map selector.

## Place nodes as markers

1. Ensure the selected map already has an image.
2. Open the Explorer panel.
3. Drag a node from the Explorer onto the desired map position.
4. Drag an unlocked marker to reposition it.
5. Double-click a marker to open its node dossier.
6. Right-click it to lock, unlock, remove, or use the normal node actions.

Marker management requires **Place markers** permission.

## Node images

Open a node's **Overview** and choose **Add image**, or drop an image onto its image area. The same control replaces an existing image. Uploading node images requires **Add images** permission.

## Storage behaviour

Docker installations use the bundled private MinIO bucket. Other deployments can configure any S3-compatible service. When S3 is not configured, Atlore falls back to the local `STORAGE_PATH` directory.

Uploaded files are served only after Atlore verifies campaign membership and node visibility. Do not expose the underlying storage bucket publicly.
