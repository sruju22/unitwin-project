/**
 * Default prototype room register for Academic Building 1 (C-Block / BLD001).
 * Complements the 397 MongoDB rooms with detailed laboratory and smart room definitions.
 */

const DEFAULT_ROOMS = [
  // Floor 1
  { id: 'C101', roomNumber: 'C101', floorNumber: 1, roomType: 'Classroom', label: 'C101 — Classroom', capacity: 70, block: 'C', buildingId: 'BLD001' },
  { id: 'C102', roomNumber: 'C102', floorNumber: 1, roomType: 'Classroom', label: 'C102 — Classroom', capacity: 70, block: 'C', buildingId: 'BLD001' },
  { id: 'C103', roomNumber: 'C103', floorNumber: 1, roomType: 'Classroom', label: 'C103 — Classroom', capacity: 70, block: 'C', buildingId: 'BLD001' },
  { id: 'C104', roomNumber: 'C104', floorNumber: 1, roomType: 'Smart Room', label: 'C104 — Smart Room', capacity: 40, block: 'C', buildingId: 'BLD001' },
  { id: 'C105', roomNumber: 'C105', floorNumber: 1, roomType: 'HOP Room', label: 'C105 — HOP Room', capacity: 30, block: 'C', buildingId: 'BLD001' },
  { id: 'C106', roomNumber: 'C106', floorNumber: 1, roomType: 'Staff Room', label: 'C106 — Staff Room', capacity: 10, block: 'C', buildingId: 'BLD001' },
  { id: 'C107', roomNumber: 'C107', floorNumber: 1, roomType: 'Sir CV Raman Lab', roomName: 'Sir CV Raman Lab', label: 'C107 — Sir CV Raman Lab', capacity: 30, block: 'C', buildingId: 'BLD001' },
  { id: 'C108', roomNumber: 'C108', floorNumber: 1, roomType: 'Sir CV Raman Lab', roomName: 'Sir CV Raman Lab', label: 'C108 — Sir CV Raman Lab', capacity: 30, block: 'C', buildingId: 'BLD001' },
  { id: 'C109', roomNumber: 'C109', floorNumber: 1, roomType: 'Staff Room', roomName: 'Sri Staffroom', label: 'C109 — Sri Staffroom', capacity: 15, block: 'C', buildingId: 'BLD001' },
  { id: 'C123', roomNumber: 'C123', floorNumber: 1, roomType: 'Laboratory', roomName: 'Capgemini Lab', label: 'C123 — Capgemini Lab', capacity: 35, block: 'C', buildingId: 'BLD001' },

  // Floor 2
  { id: 'C201', roomNumber: 'C201', floorNumber: 2, roomType: 'Classroom', label: 'C201 — Classroom', capacity: 70, block: 'C', buildingId: 'BLD001' },
  { id: 'C202', roomNumber: 'C202', floorNumber: 2, roomType: 'C++ Basics Lab / Microcontroller Lab / Embedded System Lab', roomName: 'C++ Basics Lab / Microcontroller Lab / Embedded System Lab', label: 'C202 — Embedded Systems Lab', capacity: 40, block: 'C', buildingId: 'BLD001' },
  { id: 'C203', roomNumber: 'C203', floorNumber: 2, roomType: 'Classroom', label: 'C203 — Classroom', capacity: 70, block: 'C', buildingId: 'BLD001' },
  { id: 'C204', roomNumber: 'C204', floorNumber: 2, roomType: 'Classroom', label: 'C204 — Classroom', capacity: 70, block: 'C', buildingId: 'BLD001' },
  { id: 'C205', roomNumber: 'C205', floorNumber: 2, roomType: 'Staff Room', label: 'C205 — Staff Room', capacity: 10, block: 'C', buildingId: 'BLD001' },
  { id: 'C206', roomNumber: 'C206', floorNumber: 2, roomType: 'Girls Washroom', label: 'C206 — Girls Washroom', capacity: null, block: 'C', buildingId: 'BLD001' },
  { id: 'C207', roomNumber: 'C207', floorNumber: 2, roomType: 'Boys Washroom', label: 'C207 — Boys Washroom', capacity: null, block: 'C', buildingId: 'BLD001' },

  // Floor 3
  { id: 'C301', roomNumber: 'C301', floorNumber: 3, roomType: 'Classroom', label: 'C301 — Classroom', capacity: 70, block: 'C', buildingId: 'BLD001' },
  { id: 'C302', roomNumber: 'C302', floorNumber: 3, roomType: 'Classroom', label: 'C302 — Classroom', capacity: 70, block: 'C', buildingId: 'BLD001' },
  { id: 'C303', roomNumber: 'C303', floorNumber: 3, roomType: 'Classroom', label: 'C303 — Classroom', capacity: 70, block: 'C', buildingId: 'BLD001' },
  { id: 'C304', roomNumber: 'C304', floorNumber: 3, roomType: 'Classroom', label: 'C304 — Classroom', capacity: 70, block: 'C', buildingId: 'BLD001' },
  { id: 'C305', roomNumber: 'C305', floorNumber: 3, roomType: 'Lab', roomName: 'CAED Lab', label: 'C305 — CAED Lab', capacity: 30, block: 'C', buildingId: 'BLD001' },
  { id: 'C306', roomNumber: 'C306', floorNumber: 3, roomType: 'Staff Room', label: 'C306 — Staff Room', capacity: 10, block: 'C', buildingId: 'BLD001' },
  { id: 'C307', roomNumber: 'C307', floorNumber: 3, roomType: 'Lab', roomName: 'Virtual Instrument Lab', label: 'C307 — Virtual Instrument Lab', capacity: 30, block: 'C', buildingId: 'BLD001' },
  { id: 'C311', roomNumber: 'C311', floorNumber: 3, roomType: 'CAED Lab', roomName: 'CAED Lab', label: 'C311 — CAED Lab', capacity: 35, block: 'C', buildingId: 'BLD001' },
  { id: 'C320', roomNumber: 'C320', floorNumber: 3, roomType: 'Sir M H Jayaprakash Narayan Computer Lab', roomName: 'Sir M H Jayaprakash Narayan Computer Lab', label: 'C320 — Sir M H Jayaprakash Narayan Computer Lab', capacity: 40, block: 'C', buildingId: 'BLD001' },
  { id: 'C325', roomNumber: 'C325', floorNumber: 3, roomType: 'Dr. APJ Abdul Kalam Lab', roomName: 'Dr. APJ Abdul Kalam Lab', label: 'C325 — Dr. APJ Abdul Kalam Lab', capacity: 40, block: 'C', buildingId: 'BLD001' },
  { id: 'C308', roomNumber: 'C308', floorNumber: 3, roomType: 'Girls Washroom', label: 'C308 — Girls Washroom', capacity: null, block: 'C', buildingId: 'BLD001' },
  { id: 'C309', roomNumber: 'C309', floorNumber: 3, roomType: 'Boys Washroom', label: 'C309 — Boys Washroom', capacity: null, block: 'C', buildingId: 'BLD001' },

  // Block A Laboratories (BLD001, Block A)
  { id: 'A-110', roomNumber: 'A-110', floorNumber: 1, roomType: 'Physics Laboratory', roomName: 'Physics Laboratory', label: 'A-110 — Physics Laboratory', capacity: 40, block: 'A', buildingId: 'BLD001' },
  { id: 'A-112', roomNumber: 'A-112', floorNumber: 1, roomType: 'Physics Laboratory', roomName: 'Physics Laboratory - II', label: 'A-112 — Physics Laboratory - II', capacity: 40, block: 'A', buildingId: 'BLD001' },
  { id: 'A-118', roomNumber: 'A-118', floorNumber: 1, roomType: 'Chemistry Lab', roomName: 'Chemistry Lab', label: 'A-118 — Chemistry Lab', capacity: 40, block: 'A', buildingId: 'BLD001' },
  { id: 'A-119', roomNumber: 'A-119', floorNumber: 1, roomType: 'Chemistry Lab', roomName: 'Chemistry Lab', label: 'A-119 — Chemistry Lab', capacity: 40, block: 'A', buildingId: 'BLD001' },
  { id: 'A-210', roomNumber: 'A-210', floorNumber: 2, roomType: 'CAD Lab', roomName: 'CAD Lab', label: 'A-210 — CAD Lab', capacity: 40, block: 'A', buildingId: 'BLD001' },
  { id: 'A-311', roomNumber: 'A-311', floorNumber: 3, roomType: 'PG Lab', roomName: 'PG Lab', label: 'A-311 — PG Lab', capacity: 35, block: 'A', buildingId: 'BLD001' },
  { id: 'A-312', roomNumber: 'A-312', floorNumber: 3, roomType: 'Mathematics Lab', roomName: 'Mathematics Lab', label: 'A-312 — Mathematics Lab', capacity: 35, block: 'A', buildingId: 'BLD001' },
  { id: 'A-314', roomNumber: 'A-314', floorNumber: 3, roomType: 'Career Development Multi Skilling Lab', roomName: 'Career Development Multi Skilling Lab', label: 'A-314 — Career Development Multi Skilling Lab', capacity: 50, block: 'A', buildingId: 'BLD001' },
  { id: 'A-320', roomNumber: 'A-320', floorNumber: 3, roomType: 'Computer Lab', roomName: 'Computer Lab', label: 'A-320 — Computer Lab', capacity: 40, block: 'A', buildingId: 'BLD001' },

  // Block B Laboratories (BLD001, Block B)
  { id: 'B-301', roomNumber: 'B-301', floorNumber: 3, roomType: 'Laboratory', roomName: 'Team Neptunex', label: 'B-301 — Team Neptunex', capacity: 30, block: 'B', buildingId: 'BLD001' },
  { id: 'B-302', roomNumber: 'B-302', floorNumber: 3, roomType: 'Laboratory', roomName: 'Siddartha Lab', label: 'B-302 — Siddartha Lab', capacity: 40, block: 'B', buildingId: 'BLD001' },
  { id: 'B-304', roomNumber: 'B-304', floorNumber: 3, roomType: 'Computer Lab', roomName: 'Computer Lab', label: 'B-304 — Computer Lab', capacity: 40, block: 'B', buildingId: 'BLD001' },
  { id: 'B-305', roomNumber: 'B-305', floorNumber: 3, roomType: 'Computer Lab', roomName: 'Computer Lab Back Entrance', label: 'B-305 — Computer Lab Back Entrance', capacity: 30, block: 'B', buildingId: 'BLD001' },
];

function getDefaultRooms() {
  return DEFAULT_ROOMS;
}

module.exports = {
  DEFAULT_ROOMS,
  getDefaultRooms,
};
