const { Project, SyntaxKind } = require('ts-morph');
const fs = require('fs');

const project = new Project();
project.addSourceFilesAtPaths("src/pages/**/*.tsx");
project.addSourceFilesAtPaths("src/components/**/*.tsx");
project.addSourceFilesAtPaths("src/pages/admin/**/*.tsx");

const files = project.getSourceFiles();

let fixedFiles = 0;

files.forEach(sourceFile => {
  const text = sourceFile.getFullText();
  
  // If the file uses t( but doesn't import useTranslation
  if (text.includes('{t(') || text.includes(' t(')) {
    let modified = false;
    
    // 1. Add Import if missing
    const imports = sourceFile.getImportDeclarations();
    const hasI18nImport = imports.some(imp => imp.getModuleSpecifierValue() === 'react-i18next');
    
    if (!hasI18nImport) {
      sourceFile.addImportDeclaration({
        namedImports: ['useTranslation'],
        moduleSpecifier: 'react-i18next'
      });
      modified = true;
    }
    
    // 2. Add hook to component
    // We assume the default export or first exported function is the component
    const functions = sourceFile.getFunctions();
    const arrowFunctions = sourceFile.getDescendantsOfKind(SyntaxKind.ArrowFunction);
    
    // Find the main component (heuristics: exported, or PascalCase name)
    let mainComp = null;
    
    // Check standard functions
    for (const func of functions) {
      const name = func.getName();
      if (name && name[0] === name[0].toUpperCase() && func.isExported()) {
        mainComp = func;
        break;
      }
    }
    
    // If not found, try any exported function
    if (!mainComp) {
      for (const func of functions) {
        if (func.isExported()) {
          mainComp = func;
          break;
        }
      }
    }
    
    // Try variable declarations with arrow functions (const MyComponent = () => ...)
    if (!mainComp) {
      const varDecls = sourceFile.getVariableDeclarations();
      for (const vd of varDecls) {
        const name = vd.getName();
        if (name && name[0] === name[0].toUpperCase()) {
          const init = vd.getInitializer();
          if (init && (init.getKind() === SyntaxKind.ArrowFunction || init.getKind() === SyntaxKind.FunctionExpression)) {
            mainComp = init;
            break;
          }
        }
      }
    }

    if (mainComp) {
      const body = mainComp.getBody();
      if (body && body.getKind() === SyntaxKind.Block) {
        const bodyText = body.getText();
        if (!bodyText.includes('const { t }')) {
          // Insert at the beginning of the block
          body.insertStatements(0, 'const { t } = useTranslation();');
          modified = true;
        }
      }
    } else {
      console.log(`Warning: Could not find main component in ${sourceFile.getFilePath()}`);
    }
    
    if (modified) {
      sourceFile.saveSync();
      fixedFiles++;
    }
  }
});

console.log(`Fixed imports and hooks in ${fixedFiles} files.`);
