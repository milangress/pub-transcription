# CSS to Codemirror Parser Tree Documentation

## Overview

This documentation explains how Codemirror parses SCSS code into its internal parser tree representation. Understanding this structure is valuable for developing tools that work with CSS/SCSS syntax, creating custom linters, or building code analysis tools.

## SCSS Source Code Example

The example SCSS code features a single CSS rule set with various properties, including:

- Basic property declarations
- Function calls (e.g., `transform: skew()`)
- Calculations with SASS variables
- Comments (both single-line and multi-line)
- Complex value types (multiple values, comma-separated lists)
- Color values using RGBA functions with variables

```scss
.el {
  display: inline-block;
  transform: skew(30deg, 2deg);
  line-height: $m2 * 2;
  // filter: drop-shadow(16px 16px 10px black);
  letter-spacing: $m5 * 5px;
  text-decoration: blue wavy underline $m1 * 5px;

  // text-shadow: 2px 2px 10px red;
  // text-shadow: 5px 5px #000;
  text-shadow: 1px 1px 2px red, 0 0 1em blue, 0 0 0.2em blue;
  
  // color: white;
  //text-shadow: 1px 1px 4px black, 0 0 1em black, 0 0 10px black;
  
  filter: url(#outline);
  font-family: American Typewriter;
  
  background: rgba($bgR * 2, $bgG, $bgB, $bgA);
  rotate: $r1 * 1deg;
  font-size: $fsz * 1em;
  // font-family: NIKITA-Regular;
}
```

## Parser Tree Structure

Codemirror generates a hierarchical parser tree that breaks down the SCSS code into logical units. The top-level node is `StyleSheet`, which contains the entire document:

```bash
StyleSheet
└── RuleSet
    ├── ClassSelector
    │   └── ClassName (.el)
    └── Block
        ├── Declaration (display)
        ├── Declaration (transform)
        │   └── CallExpression (skew)
        │       └── ArgList
        │           ├── NumberLiteral (30deg)
        │           └── NumberLiteral (2deg)
        ├── Declaration (line-height)
        │   └── BinaryExpression
        │       ├── SassVariableName ($m2)
        │       ├── BinOp (*)
        │       └── NumberLiteral (2)
        ├── LineComment
        ├── Declaration (letter-spacing)
        │   └── BinaryExpression
        │       ├── SassVariableName ($m5)
        │       ├── BinOp (*)
        │       └── NumberLiteral (5px)
        ├── Declaration (text-decoration)
        │   ├── ValueName (blue)
        │   ├── ValueName (wavy)
        │   ├── ValueName (underline)
        │   └── BinaryExpression
        │       ├── SassVariableName ($m1)
        │       ├── BinOp (*)
        │       └── NumberLiteral (5px)
        ├── LineComment
        ├── LineComment
        ├── Declaration (text-shadow)
        │   ├── First shadow group
        │   ├── Second shadow group
        │   └── Third shadow group
        ├── LineComment
        ├── LineComment
        ├── Declaration (filter)
        │   └── CallLiteral (url(#outline))
        ├── Declaration (font-family)
        │   └── ValueName (American Typewriter)
        ├── Declaration (background)
        │   └── CallExpression (rgba)
        │       └── ArgList
        │           ├── BinaryExpression ($bgR * 2)
        │           ├── SassVariableName ($bgG)
        │           ├── SassVariableName ($bgB)
        │           └── SassVariableName ($bgA)
        ├── Declaration (rotate)
        │   └── BinaryExpression
        │       ├── SassVariableName ($r1)
        │       ├── BinOp (*)
        │       └── NumberLiteral (1deg)
        ├── Declaration (font-size)
        │   └── BinaryExpression
        │       ├── SassVariableName ($fsz)
        │       ├── BinOp (*)
        │       └── NumberLiteral (1em)
        └── LineComment
```

## Node Types Explanation

1. **StyleSheet**: Root node that contains all CSS/SCSS content
2. **RuleSet**: A CSS rule containing a selector and declarations block
3. **ClassSelector**: A class-based selector (e.g., `.el`)
4. **Block**: The content within curly braces `{ ... }`
5. **Declaration**: A property-value pair (e.g., `display: inline-block;`)
   - **PropertyName**: The property being set (e.g., `display`)
   - **ValueName**: Simple value identifier (e.g., `inline-block`, `blue`)
6. **NumberLiteral**: Numeric values, often with units
   - **(Unit)**: Indication that the number has a unit (e.g., `px`, `deg`, `em`)
7. **CallExpression**: Function calls (e.g., `skew()`, `rgba()`)
   - **Callee**: Function name
   - **ArgList**: Arguments passed to the function
8. **BinaryExpression**: Mathematical operations (e.g., `$m2 * 2`)
   - **SassVariableName**: SASS variables (e.g., `$m2`)
   - **BinOp**: Binary operator (e.g., `*`)
9. **LineComment**: Single-line comments (`// comment`)
10. **CallLiteral**: URL and other specialized function calls

## Key Observations

1. **Variable Operations**: Sass variables are parsed as SassVariableName nodes, and operations on them are represented as BinaryExpressions.

2. **Comments**: Line comments become LineComment nodes but don't affect the structure of declarations.

3. **Property Values**: Values can be:
   - Simple (ValueName)
   - Complex (multiple ValueName nodes)
   - Function calls (CallExpression)
   - Mathematical expressions (BinaryExpression)

4. **List Values**: For properties that accept multiple comma-separated values (like text-shadow), each group is represented individually in the tree.

5. **Units**: NumberLiteral nodes can have Unit annotations when they include CSS units like px, deg, em.
