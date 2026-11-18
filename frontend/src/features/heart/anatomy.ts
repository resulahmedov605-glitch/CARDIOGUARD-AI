// Exact HRA node names and source ontology IDs. Group labels avoid disputed side-specific source labels.
export type LayerId = 'chambers' | 'vessels' | 'interior'
export type AnatomyLayers = Record<LayerId, boolean>
export const defaultLayers: AnatomyLayers = { chambers: true, vessels: true, interior: true }
export const anatomyGroups = [
  { id: 'chambers', name: 'Chambers', layerName: 'Chamber walls' },
  { id: 'vessels', name: 'Vessels', layerName: 'Blood vessels' },
  { id: 'interior', name: 'Internal', layerName: 'Internal structures' },
] as const

export const structures = [
  {
    "id": "right-atrium",
    "name": "Right atrium",
    "layer": "chambers",
    "description": "An upper chamber that receives oxygen-poor blood returning from the body.",
    "function": "Passes blood through the tricuspid valve to the right ventricle.",
    "pathway": "Body → venae cavae → right atrium",
    "meshes": [
      {
        "node": "VH_F_right_cardiac_atrium",
        "ontology": "UBERON:0002078"
      }
    ],
    "color": "#bf6268"
  },
  {
    "id": "right-ventricle",
    "name": "Right ventricle",
    "layer": "chambers",
    "description": "A lower chamber that supplies the circulation through the lungs.",
    "function": "Pumps blood through the pulmonary valve into the pulmonary arteries.",
    "pathway": "Right ventricle → pulmonary arteries → lungs",
    "meshes": [
      {
        "node": "VH_F_right_ventricle",
        "ontology": "UBERON:0002080"
      }
    ],
    "color": "#bd5960"
  },
  {
    "id": "left-atrium",
    "name": "Left atrium",
    "layer": "chambers",
    "description": "An upper chamber that receives oxygen-rich blood returning from the lungs.",
    "function": "Passes blood through the mitral valve to the left ventricle.",
    "pathway": "Lungs → pulmonary veins → left atrium",
    "meshes": [
      {
        "node": "VH_F_left_cardiac_atrium",
        "ontology": "UBERON:0002079"
      }
    ],
    "color": "#c77579"
  },
  {
    "id": "left-ventricle",
    "name": "Left ventricle",
    "layer": "chambers",
    "description": "A muscular lower chamber that supplies the circulation through the body.",
    "function": "Pumps blood through the aortic valve into the aorta.",
    "pathway": "Left ventricle → aorta → body",
    "meshes": [
      {
        "node": "VH_F_left_ventricle",
        "ontology": "UBERON:0002084"
      }
    ],
    "color": "#b95b61"
  },
  {
    "id": "aorta",
    "name": "Aorta",
    "layer": "vessels",
    "description": "The main artery leaving the left ventricle.",
    "function": "Carries oxygen-rich blood into the systemic circulation.",
    "pathway": "Left ventricle → aorta → body",
    "meshes": [
      {
        "node": "VH_F_ascending_aorta",
        "ontology": "UBERON:0001496"
      },
      {
        "node": "VH_F_aortic_arch",
        "ontology": "UBERON:0001508"
      },
      {
        "node": "VH_F_descending_aorta_a",
        "ontology": "UBERON:0001514"
      }
    ],
    "color": "#c83c4c"
  },
  {
    "id": "pulmonary-arteries",
    "name": "Pulmonary arteries",
    "layer": "vessels",
    "description": "The pulmonary trunk divides into branches toward the lungs.",
    "function": "Carry oxygen-poor blood from the right ventricle to the lungs.",
    "pathway": "Right ventricle → pulmonary arteries → lungs",
    "meshes": [
      {
        "node": "VH_F_pulmonary_trunk",
        "ontology": "UBERON:0002333"
      },
      {
        "node": "VH_F_pulmonary_artery_L",
        "ontology": "UBERON:0001652"
      },
      {
        "node": "VH_F_pulmonary_artery_R",
        "ontology": "UBERON:0001651"
      }
    ],
    "color": "#567fb5"
  },
  {
    "id": "pulmonary-veins",
    "name": "Pulmonary veins",
    "layer": "vessels",
    "description": "Vessels returning blood from the lungs.",
    "function": "Deliver oxygen-rich blood to the left atrium.",
    "pathway": "Lungs → pulmonary veins → left atrium",
    "meshes": [
      {
        "node": "VH_F_pulmonary_vein_L_sup",
        "ontology": "FMA:49916"
      },
      {
        "node": "VH_F_pulmonary_vein_R_inf",
        "ontology": "FMA:49913"
      },
      {
        "node": "VH_F_pulmonary_vein_R_sup",
        "ontology": "FMA:49914"
      },
      {
        "node": "VH_F_pulmonary_vein_L_inf",
        "ontology": "FMA:49911"
      }
    ],
    "color": "#d35e6c"
  },
  {
    "id": "superior-vena-cava",
    "name": "Superior vena cava",
    "layer": "vessels",
    "description": "A large vein entering the right atrium from above.",
    "function": "Returns blood from the upper body.",
    "pathway": "Upper body → superior vena cava → right atrium",
    "meshes": [
      {
        "node": "VH_F_superior_vena_cava",
        "ontology": "FMA:4720"
      }
    ],
    "color": "#5073ae"
  },
  {
    "id": "inferior-vena-cava",
    "name": "Inferior vena cava",
    "layer": "vessels",
    "description": "A large vein entering the right atrium from below.",
    "function": "Returns blood from the lower body.",
    "pathway": "Lower body → inferior vena cava → right atrium",
    "meshes": [
      {
        "node": "VH_F_inferior_vena_cava_a",
        "ontology": "FMA:10951"
      }
    ],
    "color": "#5073ae"
  },
  {
    "id": "left-coronary-arteries",
    "name": "Left coronary artery and branches",
    "layer": "vessels",
    "description": "Surface vessels supplying the heart muscle.",
    "function": "Deliver oxygenated blood to regions of the myocardium.",
    "pathway": "Aorta → left coronary branches → heart muscle",
    "meshes": [
      {
        "node": "VH_F_left_coronary_artery",
        "ontology": "UBERON:0001626"
      },
      {
        "node": "VH_F_left_circumflex_artery",
        "ontology": "UBERON:0035422"
      },
      {
        "node": "VH_F_diagonal_branch_of_left_anterior_descending_artery",
        "ontology": "FMA:3860"
      },
      {
        "node": "VH_F_left_marginal_branch",
        "ontology": "FMA:3902"
      },
      {
        "node": "VH_F_left_posterior_descending_branch_of_circumflex_branch_of_left_coronary_artery",
        "ontology": "FMA:322904"
      },
      {
        "node": "VH_F_posterior_left_ventricular_branch",
        "ontology": "FMA:13905"
      }
    ],
    "color": "#c82e45"
  },
  {
    "id": "right-coronary-arteries",
    "name": "Right coronary artery and branch",
    "layer": "vessels",
    "description": "A coronary artery and its marginal branch on the heart surface.",
    "function": "Deliver oxygenated blood to regions of the myocardium.",
    "pathway": "Aorta → right coronary branches → heart muscle",
    "meshes": [
      {
        "node": "VH_F_right_coronary_artery",
        "ontology": "UBERON:0001625"
      },
      {
        "node": "VH_F_right_marginal_artery",
        "ontology": "FMA:3818"
      }
    ],
    "color": "#c82e45"
  },
  {
    "id": "cardiac-veins",
    "name": "Cardiac veins and coronary sinus",
    "layer": "vessels",
    "description": "Surface veins draining blood from the heart muscle.",
    "function": "Collect venous blood for return to the right atrium.",
    "pathway": "Heart muscle → cardiac veins → right atrium",
    "meshes": [
      {
        "node": "VH_F_coronary_sinus",
        "ontology": "UBERON:0005438"
      },
      {
        "node": "VH_F_great_cardiac_vein",
        "ontology": "UBERON:0006958"
      },
      {
        "node": "VH_F_middle_cardiac_vein",
        "ontology": "UBERON:0009687"
      },
      {
        "node": "VH_F_oblique_vein_of_left_atrium",
        "ontology": "FMA:4715"
      },
      {
        "node": "VH_F_left_marginal_vein",
        "ontology": "FMA:4708"
      },
      {
        "node": "VH_F_posterior_vein_of_left_ventricle",
        "ontology": "FMA:4712"
      },
      {
        "node": "VH_F_anterior_cardiac_vein",
        "ontology": "FMA:76767"
      },
      {
        "node": "VH_F_small_cardiac_vein",
        "ontology": "UBERON:0035374"
      }
    ],
    "color": "#577cb9"
  },
  {
    "id": "septum",
    "name": "Interventricular septum",
    "layer": "interior",
    "description": "The muscular partition between the two ventricles.",
    "function": "Separates the ventricular chambers.",
    "pathway": "Right ventricle | septum | left ventricle",
    "meshes": [
      {
        "node": "VH_F_interventricular_septum",
        "ontology": "UBERON:0002094"
      }
    ],
    "color": "#ae5960"
  },
  {
    "id": "tricuspid-valve",
    "name": "Tricuspid valve",
    "layer": "interior",
    "description": "The valve between the right atrium and right ventricle.",
    "function": "Helps prevent backward flow during ventricular contraction.",
    "pathway": "Right atrium → tricuspid valve → right ventricle",
    "meshes": [
      {
        "node": "VH_F_tricuspid_valve",
        "ontology": "UBERON:0002134"
      }
    ],
    "color": "#e3c8a5"
  },
  {
    "id": "pulmonary-valve",
    "name": "Pulmonary valve",
    "layer": "interior",
    "description": "The valve at the outlet of the right ventricle.",
    "function": "Helps prevent backward flow from the pulmonary trunk.",
    "pathway": "Right ventricle → pulmonary valve → pulmonary trunk",
    "meshes": [
      {
        "node": "VH_F_pulmonary_valve",
        "ontology": "UBERON:0002146"
      }
    ],
    "color": "#e3c8a5"
  },
  {
    "id": "mitral-valve",
    "name": "Mitral valve",
    "layer": "interior",
    "description": "The valve between the left atrium and left ventricle.",
    "function": "Helps prevent backward flow during ventricular contraction.",
    "pathway": "Left atrium → mitral valve → left ventricle",
    "meshes": [
      {
        "node": "VH_F_mitral_valve",
        "ontology": "UBERON:0002135"
      }
    ],
    "color": "#e3c8a5"
  },
  {
    "id": "aortic-valve",
    "name": "Aortic valve",
    "layer": "interior",
    "description": "The valve at the outlet of the left ventricle.",
    "function": "Helps prevent backward flow from the aorta.",
    "pathway": "Left ventricle → aortic valve → aorta",
    "meshes": [
      {
        "node": "VH_F_aortic_valve",
        "ontology": "UBERON:0002137"
      }
    ],
    "color": "#e3c8a5"
  },
  {
    "id": "papillary-muscles",
    "name": "Papillary muscles",
    "layer": "interior",
    "description": "Muscles projecting into the ventricular cavities.",
    "function": "Tension the chordae tendineae to support the atrioventricular valve leaflets.",
    "pathway": "Ventricular muscle → chordae tendineae → valve leaflets",
    "meshes": [
      {
        "node": "VH_F_papillary_muscle_of_heart_ant",
        "ontology": "FMA:7264"
      },
      {
        "node": "VH_F_papillary_muscle_of_heart_antlat",
        "ontology": "FMA:7265"
      },
      {
        "node": "VH_F_papillary_muscle_of_heart_med",
        "ontology": "FMA:7262"
      },
      {
        "node": "VH_F_papillary_muscle_of_heart_pos",
        "ontology": "FMA:7261"
      },
      {
        "node": "VH_F_papillary_muscle_of_heart_posmed",
        "ontology": "FMA:7267"
      }
    ],
    "color": "#c28a78"
  }
] as const

export type StructureId = (typeof structures)[number]['id']

export function identifyStructure(node: string, ontology: unknown): StructureId | null {
  return structures.find((structure) =>
    structure.meshes.some((mesh) => mesh.node === node && mesh.ontology === ontology),
  )?.id ?? null
}

export const circulation = [
  'Body', 'Right atrium', 'Right ventricle', 'Pulmonary arteries', 'Lungs',
  'Pulmonary veins', 'Left atrium', 'Left ventricle', 'Aorta', 'Body',
]
