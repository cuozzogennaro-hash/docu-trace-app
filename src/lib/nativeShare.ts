import { isNativePlatform } from "./platform";

/**
 * Save (and share/open) a PDF generated with jsPDF.
 * - On web: triggers a normal browser download via doc.save().
 * - On native (iOS/Android via Capacitor): writes the PDF to the Cache
 *   directory and opens the system share sheet so the user can save it
 *   to Files, AirDrop, print, etc. Without this, jsPDF's blob/anchor
 *   download is silently blocked by the WKWebView and nothing happens.
 */
export async function savePdfDocument(doc: any, filename: string): Promise<void> {
  if (!isNativePlatform()) {
    doc.save(filename);
    return;
  }

  const [{ Filesystem, Directory }, { Share }] = await Promise.all([
    import("@capacitor/filesystem"),
    import("@capacitor/share"),
  ]);

  // jsPDF -> base64 (without data URI prefix)
  const dataUri: string = doc.output("datauristring");
  const base64 = dataUri.includes(",") ? dataUri.split(",")[1] : dataUri;

  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const written = await Filesystem.writeFile({
    path: safeName,
    data: base64,
    directory: Directory.Cache,
  });

  try {
    await Share.share({
      title: filename,
      url: written.uri,
      dialogTitle: "Condividi PDF",
    });
  } catch (err: any) {
    // User cancelled the share sheet — not an error worth surfacing.
    if (!/cancel/i.test(String(err?.message ?? err))) throw err;
  }
}

/**
 * Open arbitrary HTML on the device. On web it pops a new tab; on native
 * it writes the HTML to the Cache directory and opens the share sheet
 * (the user can then open it in Safari/Chrome to print).
 */
export async function openHtmlDocument(html: string, filename: string): Promise<boolean> {
  if (!isNativePlatform()) {
    const win = window.open("", "_blank");
    if (win) {
      win.document.open();
      win.document.write(html);
      win.document.close();
      return true;
    }
    const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    window.location.href = url;
    return true;
  }

  const [{ Filesystem, Directory }, { Share }] = await Promise.all([
    import("@capacitor/filesystem"),
    import("@capacitor/share"),
  ]);

  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
  const written = await Filesystem.writeFile({
    path: safeName,
    data: html,
    directory: Directory.Cache,
    encoding: "utf8" as any,
  });

  try {
    await Share.share({
      title: filename,
      url: written.uri,
      dialogTitle: "Apri / Condividi",
    });
    return true;
  } catch (err: any) {
    if (/cancel/i.test(String(err?.message ?? err))) return true;
    throw err;
  }
}