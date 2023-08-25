import { ChainContextType } from '@/chainFactory'
import { TFile, TFolder } from 'obsidian'
import {
  getCombinedFolderContent,
  getFileContent,
  getFileName,
  getFolderName,
  getMarkdownFilesWithTag,
  notifyUser
} from '@/utils'
import CodeMirror from 'codemirror'

export interface ChainContext {
  name: string
  content: string
}

export async function getChainContext(contextType: ChainContextType, searchKey: string): Promise<ChainContext | null> {
  switch (contextType) {
    case ChainContextType.ACTIVE_NOTE: {
      const file = app.workspace.getActiveFile();
      if (!file) {
        notifyUser('No active note found.');
        return null;
      }
      const noteContent = await getFileContent(file);
      const noteName = getFileName(file);
      if (!noteContent) {
        notifyUser('No note content found.');
        return null;
      }
      return {
        name: `[[${noteName}]]`,
        content: noteContent
      };
    }
    case ChainContextType.SELECTION: {
      // TODO: This does not work, find a way to get the selected text in the editor, given that the active editor is the chat window
      const editor = await new Promise<CodeMirror.Editor | null>((resolve, reject) => {
        let resolved = false;
        app.workspace.iterateCodeMirrors((editor) => {
          resolved = true;
          resolve(editor)
        })
        setTimeout(() => {
          if (!resolved) {
            resolve(null)
          }
        }, 1000)
      })
      if (!editor) {
        notifyUser('No active editor found.');
        return null;
      }
      if (!editor.somethingSelected()) {
        notifyUser('Please select some text to rewrite.', false);
        return null;
      }
      const selectedText = editor.getSelection();
      return {
        name: 'Selection',
        content: selectedText
      }
    }
    case ChainContextType.NOTE: {
      let filePath = searchKey;
      if (!filePath.endsWith('.md')) {
        filePath += '.md';
      }
      const file = app.vault.getAbstractFileByPath(filePath)
      if (!file) {
        notifyUser('No note found.');
        return null;
      }
      if (file instanceof TFile) {
        const noteContent = await getFileContent(file);
        const noteName = getFileName(file);
        if (!noteContent) {
          notifyUser('No note content found.');
          return null;
        }
        return {
          name: `[[${noteName}]]`,
          content: noteContent
        };
      } else {
        notifyUser('No note found.');
        return null;
      }
    }
    case ChainContextType.FOLDER: {
      const folder = app.vault.getAbstractFileByPath(searchKey)
      if (!folder) {
        notifyUser('No folder found.');
        return null;
      }
      if (folder instanceof TFolder) {
        const folderContent = await getCombinedFolderContent(folder);
        const folderName = getFolderName(folder);
        if (!folderContent) {
          notifyUser('No folder content found.');
          return null;
        }
        return {
          name: `Folder ${folderName}`,
          content: folderContent
        };
      } else {
        notifyUser('No folder found.');
        return null;
      }
    }
    case ChainContextType.TAG: {
      const files = getMarkdownFilesWithTag(searchKey)
      if (files.length === 0) {
        notifyUser(`No note found with tag ${searchKey}.`);
        return null;
      }
      const contents = await Promise.all(files.map(async (file) => {
        const content = await getFileContent(file) ?? '';
        return `# ${file.name}\n\n${content}`;
      }))
      const combinedContent = contents.join('\n\n')
      return {
        name: searchKey,
        content: combinedContent
      }
    }
  }
}
