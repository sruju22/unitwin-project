import React from 'react';
import Corridors from './Corridors';
import StructureShell from './StructureShell';
import SouthBumpOut from './SouthBumpOut';

export default function GroundFloor() {
  return (
    <group>
      <Corridors yOffset={0} />
      <StructureShell yOffset={0} />
      <SouthBumpOut yOffset={0} isGround={true} />
    </group>
  );
}
