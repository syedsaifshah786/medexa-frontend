export type SessionStatus = "active" | "Awaiting";

export type UpcomingSession = {
  id: string;
  name: string;
  status: SessionStatus;
  careType: string;
  cpt: string;
  icd: string;
  time: string;
  img: string;
  ageSex: string;
  weight: string;
  mrn: string;
  payor: string;
};

export const sessions: UpcomingSession[] = [
  {
    id: "samuel-thompson",
    name: "Samuel Thompson",
    status: "active",
    careType: "Chronic Care MGT",
    cpt: "99490",
    icd: "E11.9",
    time: "July 05, 12:00 PM",
    img: "https://i.pravatar.cc/80?img=12",
    ageSex: "58 / Male",
    weight: "88 kg",
    mrn: "220486",
    payor: "Medicare",
  },
  {
    id: "amina-hassan",
    name: "Amina Hassan",
    status: "Awaiting",
    careType: "Physical Therapy",
    cpt: "97110",
    icd: "M54.5",
    time: "July 05, 01:00 PM",
    img: "https://i.pravatar.cc/80?img=32",
    ageSex: "64 / Female",
    weight: "72 kg",
    mrn: "220487",
    payor: "Aetna",
  },
  {
    id: "robert-chen",
    name: "Robert Chen",
    status: "Awaiting",
    careType: "Neuromuscular Rehab",
    cpt: "97112",
    icd: "R26.81",
    time: "July 05, 01:30 PM",
    img: "https://i.pravatar.cc/80?img=56",
    ageSex: "71 / Male",
    weight: "79 kg",
    mrn: "220488",
    payor: "Medicare",
  },
  {
    id: "elena-morris",
    name: "Elena Morris",
    status: "Awaiting",
    careType: "Therapeutic Activity",
    cpt: "97530",
    icd: "M62.81",
    time: "July 05, 02:00 PM",
    img: "https://i.pravatar.cc/80?img=49",
    ageSex: "52 / Female",
    weight: "68 kg",
    mrn: "220489",
    payor: "UnitedHealthcare",
  },
  {
    id: "david-peter",
    name: "David Peter",
    status: "Awaiting",
    careType: "Chronic Care MGT",
    cpt: "99439",
    icd: "I10",
    time: "July 05, 02:30 PM",
    img: "https://i.pravatar.cc/80?img=18",
    ageSex: "60 / Male",
    weight: "84 kg",
    mrn: "220490",
    payor: "Blue Cross",
  },
  {
    id: "lina-patel",
    name: "Lina Patel",
    status: "Awaiting",
    careType: "Balance Training",
    cpt: "97116",
    icd: "R26.89",
    time: "July 05, 03:00 PM",
    img: "https://i.pravatar.cc/80?img=29",
    ageSex: "67 / Female",
    weight: "63 kg",
    mrn: "220491",
    payor: "Medicare",
  },
  {
    id: "omar-reed",
    name: "Omar Reed",
    status: "Awaiting",
    careType: "Therapeutic Exercise",
    cpt: "97110",
    icd: "M25.561",
    time: "July 05, 03:30 PM",
    img: "https://i.pravatar.cc/80?img=61",
    ageSex: "49 / Male",
    weight: "91 kg",
    mrn: "220492",
    payor: "Cigna",
  },
  {
    id: "grace-wilson",
    name: "Grace Wilson",
    status: "Awaiting",
    careType: "Care Coordination",
    cpt: "99490",
    icd: "E78.5",
    time: "July 05, 04:00 PM",
    img: "https://i.pravatar.cc/80?img=36",
    ageSex: "73 / Female",
    weight: "70 kg",
    mrn: "220493",
    payor: "Humana",
  },
];

export function getSessionById(id: string | null) {
  return sessions.find((session) => session.id === id) ?? sessions[0];
}
