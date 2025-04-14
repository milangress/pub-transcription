/**
 * Utility functions for merging CSS styles between snapshots and current settings
 */

/**
 * Merge two inline styles together, treating lines as either active or deactivated (commented)
 */
export function mergeInlineStyles(currentStyle: string, snapshotStyle: string): string {
  // Extract .el {} block from both styles
  const currentElBlock = extractElBlock(currentStyle);
  const snapshotElBlock = extractElBlock(snapshotStyle);

  if (!currentElBlock || !snapshotElBlock) {
    return currentStyle; // Can't merge, return current style
  }

  // Get all active lines from snapshot
  const snapshotActiveLines = extractActiveLines(snapshotElBlock);

  // Get all lines (active and commented) from current style
  const currentLines = extractAllLines(currentElBlock);

  // Perform the merge (activate/deactivate lines)
  const mergedBlock = performLineMerge(currentLines, snapshotActiveLines);

  // Replace the current .el block with the merged one
  return currentStyle.replace(/\.el\s*\{[^}]*\}/s, mergedBlock);
}

/**
 * Extract the .el {} block from a CSS string
 */
function extractElBlock(style: string): string | null {
  const elMatch = style.match(/\.el\s*\{([^}]*)\}/s);
  return elMatch ? elMatch[0] : null;
}

/**
 * Extract active (non-commented) lines from a style block
 */
function extractActiveLines(styleBlock: string): string[] {
  // Remove the .el { } wrapper to get just the content
  const content = styleBlock.replace(/\.el\s*\{\s*([\s\S]*?)\s*\}/s, '$1');

  // Split into lines and filter out commented or empty lines
  return content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line && !line.trim().startsWith('//'));
}

/**
 * Extract all lines from a style block, preserving original formatting
 */
function extractAllLines(styleBlock: string): string[] {
  // Remove the .el { } wrapper to get just the content
  const content = styleBlock.replace(/\.el\s*\{\s*([\s\S]*?)\s*\}/s, '$1');

  // Split into lines preserving original formatting
  return content.split('\n');
}

/**
 * Perform line-by-line merge by activating/deactivating lines
 */
function performLineMerge(currentLines: string[], snapshotActiveLines: string[]): string {
  // Start with the opening bracket
  let result = '.el {';

  // Track which snapshot lines have been processed
  const processedSnapshotLines = new Set<string>();

  // Determine the standard indentation to use
  const indentation = '  '; // Always use 2 spaces as requested

  // Process each current line
  for (const line of currentLines) {
    const trimmedLine = line.trim();

    // Skip empty lines
    if (!trimmedLine) {
      result += '\n';
      continue;
    }

    // Check if this is a commented line
    const isCommented = trimmedLine.startsWith('//');

    // Get the actual content (removing comment prefix if needed)
    const contentLine = isCommented ? trimmedLine.replace(/^\s*\/\/\s*/, '').trim() : trimmedLine;

    // Check if this line exists in the snapshot's active lines
    const lineExistsInSnapshot = snapshotActiveLines.some((snapshotLine) => {
      const matches = snapshotLine.trim() === contentLine;
      if (matches) {
        processedSnapshotLines.add(snapshotLine.trim());
      }
      return matches;
    });

    if (lineExistsInSnapshot) {
      // This line should be active - ensure it's uncommented
      if (isCommented) {
        // Uncomment the line and apply consistent indentation
        result += `\n${indentation}${contentLine}`;
      } else {
        // Already active, but ensure consistent indentation
        result += `\n${indentation}${trimmedLine}`;
      }
    } else {
      // This line should be deactivated - ensure it's commented
      if (isCommented) {
        // Already commented, but ensure consistent indentation
        result += `\n${indentation}${trimmedLine}`;
      } else {
        // Comment the line and apply consistent indentation
        result += `\n${indentation}// ${contentLine}`;
      }
    }
  }

  // Add any snapshot lines that weren't in the current style
  const unprocessedSnapshotLines = snapshotActiveLines.filter(
    (line) => !processedSnapshotLines.has(line.trim()),
  );

  if (unprocessedSnapshotLines.length > 0) {
    // Add a blank line before adding new lines if the last line isn't already empty
    if (currentLines.length > 0 && currentLines[currentLines.length - 1].trim() !== '') {
      result += '\n';
    }

    // Add each new line with proper indentation
    for (const line of unprocessedSnapshotLines) {
      result += `\n${indentation}${line.trim()}`;
    }
  }

  // Add the closing bracket
  result += '\n}';

  return result;
}
