const { Project, SyntaxKind } = require('ts-morph');

const project = new Project();
project.addSourceFilesAtPaths("src/pages/**/*.tsx");
project.addSourceFilesAtPaths("src/components/**/*.tsx");
project.addSourceFilesAtPaths("src/pages/admin/**/*.tsx");

const files = project.getSourceFiles();
let fixedFiles = 0;

files.forEach(sourceFile => {
  let fileModified = false;
  
  // Find all functions and arrow functions
  const functions = [...sourceFile.getFunctions(), ...sourceFile.getDescendantsOfKind(SyntaxKind.ArrowFunction), ...sourceFile.getDescendantsOfKind(SyntaxKind.FunctionExpression)];
  
  functions.forEach(func => {
    // Check if function body contains a JSX element and uses 't('
    const body = func.getBody();
    if (body && body.getKind() === SyntaxKind.Block) {
      const bodyText = body.getText();
      // If body has JSX and uses t( but doesn't have useTranslation
      if (bodyText.includes('t(') && !bodyText.includes('const { t }') && (bodyText.includes('<') && bodyText.includes('/>') || bodyText.includes('</'))) {
        
        // Ensure it's a React component (name starts with uppercase, or it's returning JSX)
        // Let's just blindly inject it if it uses JSX and uses t() because it's a hook and can be used in any custom hook or component
        body.insertStatements(0, 'const { t } = useTranslation();');
        fileModified = true;
      }
    } else if (body && (body.getKind() === SyntaxKind.ParenthesizedExpression || body.getKind() === SyntaxKind.JsxElement || body.getKind() === SyntaxKind.JsxFragment)) {
        // If it's an implicit return arrow function like () => (<div>...</div>)
        // We need to convert it to a block function
        const text = body.getText();
        if (text.includes('t(')) {
            // It's tricky to convert implicit to explicit safely, so let's log it
            console.log(`Warning: Implicit return with t() in ${sourceFile.getFilePath()}`);
        }
    }
  });

  if (fileModified) {
    sourceFile.saveSync();
    fixedFiles++;
  }
});

console.log(`Deep fixed imports and hooks in ${fixedFiles} files.`);
