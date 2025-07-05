#!/bin/bash

# Create a backup of the original file
cp src/worklogTreeView.ts src/worklogTreeView.ts.bak

# Extract the fixed methods from fixedMethods.ts
CURRENT_CHANGES=$(cat src/fixedMethods.ts | sed -n '/async generateFromCurrentChanges/,/^}/p')
COMMIT_METHOD=$(cat src/fixedMethods.ts | sed -n '/async generateFromCommit/,/^}/p')
SPECIFIC_COMMIT_METHOD=$(cat src/fixedMethods.ts | sed -n '/async generateFromSpecificCommit/,/^}/p')

# Create a temporary file
touch temp_file.ts

# Process the file
cat src/worklogTreeView.ts | awk -v current_changes="$CURRENT_CHANGES" -v commit_method="$COMMIT_METHOD" -v specific_commit_method="$SPECIFIC_COMMIT_METHOD" '
BEGIN { in_method = 0; method_type = ""; }
/async generateFromCurrentChanges\(\): Promise<void> {/ { 
  print current_changes;
  in_method = 1;
  method_type = "current";
  next;
}
/async generateFromCommit\(\): Promise<void> {/ { 
  print commit_method;
  in_method = 1;
  method_type = "commit";
  next;
}
/async generateFromSpecificCommit\(commitHash: string\): Promise<void> {/ { 
  print specific_commit_method;
  in_method = 1;
  method_type = "specific";
  next;
}
/^  }/ {
  if (in_method) {
    in_method = 0;
    next;
  }
  print;
  next;
}
{
  if (!in_method) print;
}
' > temp_file.ts

# Replace the original file with the updated one
mv temp_file.ts src/worklogTreeView.ts

echo "Methods updated successfully!"
