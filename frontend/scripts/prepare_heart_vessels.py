"""Extract reviewed cardiac meshes from the pinned HRA female vasculature GLB.

Run from the project root with the downloaded GLB and original crosswalk paths.
Vertex, normal and index bytes remain unchanged. No vessels are synthesized.
"""

import copy
import hashlib
import json
from pathlib import Path
import struct
import sys


def prepare(source: Path, crosswalk: Path):
    raw = source.read_bytes()
    source_hash = hashlib.sha256(raw).hexdigest()
    if source_hash != '6bf794b4255c254d03afe254f765c93e7394e4397068268d4eaa3cde50ffdf60':
        raise ValueError('Source checksum changed; review the anatomical subset before regenerating')
    document_size, kind = struct.unpack_from('<II', raw, 12)
    if raw[:4] != b'glTF' or kind != 0x4E4F534A:
        raise ValueError('Expected a GLB 2.0 asset')
    document = json.loads(raw[20:20 + document_size])
    binary_start = 20 + document_size + 8
    binary = raw[binary_start:]
    # Reviewed mesh range in HRA blood-vasculature-female v1.3.
    excluded = {'VH_F_inferior_vena_cava_b', 'VH_F_left_anterior_descending_artery'}
    selected = [node for node in document['nodes']
                if 73 <= node.get('mesh', -1) <= 102 and node['name'] not in excluded]
    if len(selected) != 28 or document.get('extensionsRequired'):
        raise ValueError('Source anatomy changed; review the extraction before regenerating')
    if any(any(key in node for key in ('matrix', 'translation', 'rotation', 'scale', 'skin'))
           for node in document['nodes']):
        raise ValueError('Source transforms require an explicit spatial registration review')

    output = {'asset': {'version': '2.0', 'generator': 'CardiGuard HRA cardiac subset'},
              'scene': 0, 'scenes': [{'nodes': list(range(len(selected)))}],
              'nodes': [], 'meshes': [], 'accessors': [], 'bufferViews': [],
              'materials': copy.deepcopy(document['materials'][:2]), 'buffers': []}
    payload = bytearray()
    accessor_map = {}

    def accessor(index):
        if index in accessor_map:
            return accessor_map[index]
        value = copy.deepcopy(document['accessors'][index])
        if 'sparse' in value:
            raise ValueError('Sparse source accessors need review')
        view = document['bufferViews'][value['bufferView']]
        widths = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}
        sizes = {5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4}
        element_size = widths[value['type']] * sizes[value['componentType']]
        stride = view.get('byteStride', element_size)
        start = view.get('byteOffset', 0) + value.get('byteOffset', 0)
        while len(payload) % 4:
            payload.append(0)
        offset = len(payload)
        for position in range(value['count']):
            begin = start + position * stride
            payload.extend(binary[begin:begin + element_size])
        value['bufferView'] = len(output['bufferViews'])
        value['byteOffset'] = 0
        new_view = {'buffer': 0, 'byteOffset': offset, 'byteLength': len(payload) - offset}
        if 'target' in view:
            new_view['target'] = view['target']
        output['bufferViews'].append(new_view)
        accessor_map[index] = len(output['accessors'])
        output['accessors'].append(value)
        return accessor_map[index]

    for original in selected:
        node = copy.deepcopy(original)
        mesh = copy.deepcopy(document['meshes'][node['mesh']])
        for primitive in mesh['primitives']:
            primitive['attributes'] = {name: accessor(index) for name, index in primitive['attributes'].items()}
            primitive['indices'] = accessor(primitive['indices'])
            if primitive.get('material', 0) > 1 or primitive.get('targets'):
                raise ValueError('Unexpected cardiac mesh material or morph target')
        node['mesh'] = len(output['meshes'])
        output['nodes'].append(node)
        output['meshes'].append(mesh)
    output['buffers'] = [{'byteLength': len(payload)}]
    document_bytes = json.dumps(output, separators=(',', ':')).encode()
    document_bytes += b' ' * (-len(document_bytes) % 4)
    payload += b'\x00' * (-len(payload) % 4)
    result = (struct.pack('<III', 0x46546C67, 2, 28 + len(document_bytes) + len(payload))
              + struct.pack('<II', len(document_bytes), 0x4E4F534A) + document_bytes
              + struct.pack('<II', len(payload), 0x004E4942) + payload)
    folder = Path(__file__).resolve().parents[1] / 'public/models/heart'
    (folder / 'cardiac-vessels.glb').write_bytes(result)
    (folder / 'vessels-crosswalk.csv').write_bytes(crosswalk.read_bytes())
    metadata = {'source': 'https://purl.humanatlas.io/ref-organ/blood-vasculature-female/v1.3',
                'creators': ['Kristen Browne', 'Heidi Schlehlein'],
                'asset_url': 'https://cdn.humanatlas.io/digital-objects/ref-organ/blood-vasculature-female/v1.3/assets/3d-vh-f-blood-vasculature.glb',
                'license': 'CC BY 4.0', 'license_url': 'https://creativecommons.org/licenses/by/4.0/',
                'source_sha256': source_hash,
                'sha256': {'cardiac-vessels.glb': hashlib.sha256(result).hexdigest(),
                           'vessels-crosswalk.csv': hashlib.sha256(crosswalk.read_bytes()).hexdigest()},
                'selected_nodes': [node['name'] for node in selected],
                'changes': 'Cardiac mesh subset only. Original coordinates, vertex, normal and index bytes preserved.',
                'exclusions': {'VH_F_inferior_vena_cava_b': 'Distal abdominal segment outside the cardiac view',
                               'VH_F_left_anterior_descending_artery': 'Source name conflicts with its FMA:8636 label/identifier; excluded pending source correction'}}
    (folder / 'vessels-source.json').write_text(json.dumps(metadata, indent=2) + '\n')
    print(f'Prepared {len(selected)} cardiac vessel meshes, {len(result):,} bytes, source SHA-256 {source_hash}')


if __name__ == '__main__':
    prepare(Path(sys.argv[1]), Path(sys.argv[2]))
