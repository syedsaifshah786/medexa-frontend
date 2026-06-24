"use client";

import { createContext, useContext, useState } from "react";

export type Doctor = {
  name: string;
  role: string;
  avatar: string;
};

type DoctorContextValue = {
  doctors: Doctor[];
  selectedDoctor: Doctor;
  setSelectedDoctor: (doctor: Doctor) => void;
};

export const doctors: Doctor[] = [
  {
    name: "Dr. Sarah Miller",
    role: "Clinician",
    avatar: "https://i.pravatar.cc/80?img=47",
  },
  {
    name: "Dr. Ahmed Khan",
    role: "Therapist",
    avatar: "https://i.pravatar.cc/80?img=11",
  },
  {
    name: "Dr. Emily Carter",
    role: "Physician",
    avatar: "https://i.pravatar.cc/80?img=32",
  },
  {
    name: "Dr. Michael Lee",
    role: "Specialist",
    avatar: "https://i.pravatar.cc/80?img=53",
  },
];

const DoctorContext = createContext<DoctorContextValue | null>(null);

export function DoctorProvider({ children }: { children: React.ReactNode }) {
  const [selectedDoctor, setSelectedDoctor] = useState<Doctor>(doctors[0]);

  return (
    <DoctorContext.Provider value={{ doctors, selectedDoctor, setSelectedDoctor }}>
      {children}
    </DoctorContext.Provider>
  );
}

export function useSelectedDoctor() {
  const context = useContext(DoctorContext);

  if (!context) {
    throw new Error("useSelectedDoctor must be used within DoctorProvider");
  }

  return context;
}
