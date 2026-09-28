export const L = {
  // Dimensions
  FLOOR_HEIGHT: 4.0,
  CORRIDOR_WIDTH: 3.5,
  ROOM_DEPTH: 8.0,
  PARAPET_HEIGHT: 1.2,
  PILLAR_SIZE: 0.4,
  SLAB_THICKNESS: 0.3,

  // Geometry Bounds (Center of the courtyard is 0,0)
  // Courtyard is 32m wide (X: -16 to 16), 32m deep (Z: -16 to 16)
  COURTYARD_X: 16,
  COURTYARD_Z: 16,

  // Wings (Center lines of the corridors)
  NORTH_Z: -16 - 1.75, // -17.75
  SOUTH_Z:  16 + 1.75, //  17.75
  WEST_X:  -16 - 1.75, // -17.75
  EAST_X:   16 + 1.75, //  17.75
};
