"""Embed Mangaluru travel posters as base64 data URIs into assets/posters.js."""

import base64
from pathlib import Path


def main() -> None:
    # Project root is parent of tools/ directory
    project_root = Path(__file__).resolve().parent.parent
    posters_dir = project_root / 'assets' / 'posters'
    output_file = project_root / 'assets' / 'posters.js'

    keys = ['yakshagana', 'kambala', 'pilivesha', 'gadbad', 'panambur']
    entries = []

    for key in keys:
        img_path = posters_dir / f'{key}.jpg'
        if not img_path.is_file():
            raise FileNotFoundError(f'Missing poster image: {img_path}')
        data = img_path.read_bytes()
        b64 = base64.b64encode(data).decode('ascii')
        data_uri = f'data:image/jpeg;base64,{b64}'
        entries.append(f"    {key}: '{data_uri}',")

    lines = [
        '(function (root) {',
        "  'use strict';",
        '  const KUDLA = (root.KUDLA = root.KUDLA || {});',
        '  KUDLA.POSTERS = Object.freeze({',
    ]
    lines.extend(entries)
    lines.extend([
        '  });',
        "})(typeof window !== 'undefined' ? window : globalThis);",
        '',
    ])

    output_file.write_text('\n'.join(lines), encoding='utf-8')
    print(f'Wrote {output_file} successfully.')


if __name__ == '__main__':
    main()
