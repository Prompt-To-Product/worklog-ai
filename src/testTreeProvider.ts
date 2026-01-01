import * as vscode from 'vscode';
import { WorklogTreeDataProvider } from './worklogTreeView';

// Simple test to verify TreeDataProvider functionality
export async function testTreeDataProvider(context: vscode.ExtensionContext) {
  try {
    console.log('Testing TreeDataProvider...');
    
    const provider = new WorklogTreeDataProvider(context);
    
    // Test getChildren with no element (root level)
    const rootItems = await provider.getChildren();
    console.log('Root items count:', rootItems.length);
    
    // Test getTreeItem
    if (rootItems.length > 0) {
      const treeItem = provider.getTreeItem(rootItems[0]);
      console.log('First tree item:', treeItem.label);
    }
    
    console.log('TreeDataProvider test completed successfully');
    return true;
  } catch (error) {
    console.error('TreeDataProvider test failed:', error);
    return false;
  }
}
