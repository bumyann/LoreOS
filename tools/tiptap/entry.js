// Entry for the Journal editor bundle. The app loads the result as a classic script and uses these globals.
import { Editor, Extension, Node } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from 'tiptap-markdown';
import { Details, DetailsSummary, DetailsContent } from '@tiptap/extension-details';
import { TaskList, TaskItem } from '@tiptap/extension-list';
import { Placeholder } from '@tiptap/extensions';
import Suggestion from '@tiptap/suggestion';
import { PluginKey } from '@tiptap/pm/state';

window.TiptapEditor = Editor;
window.TiptapStarterKit = StarterKit;
window.TiptapMarkdown = Markdown;
window.TiptapExt = { Extension, Node, Details, DetailsSummary, DetailsContent, TaskList, TaskItem, Placeholder, Suggestion, PluginKey };
