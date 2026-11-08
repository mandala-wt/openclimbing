/**
 * iPhone/iPad: offers the share sheet (e.g. "In Dateien sichern", Komoot).
 * Elsewhere, or if sharing is not possible: a normal download.
 * Returns what happened so the UI can explain the next step.
 */
export const shareOrDownload = async (
  content: string,
  fileName: string,
  type: string,
): Promise<'shared' | 'downloaded' | 'cancelled'> => {
  const file = new File([content], fileName, { type });
  const nav = navigator as Navigator & {
    canShare?: (data: { files: File[] }) => boolean;
  };
  if (nav.share && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: fileName });
      return 'shared';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return 'cancelled';
      }
      // fall through to the download
    }
  }
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'downloaded';
};

export const readFileText = (file: File, maxBytes: number) => {
  if (file.size > maxBytes) {
    return Promise.reject(
      new Error(
        `Die Datei ist zu groß (${(file.size / 1e6).toLocaleString('de-DE', {
          maximumFractionDigits: 1,
        })} MB, erlaubt sind ${maxBytes / 1e6} MB).`,
      ),
    );
  }
  return file.text();
};
