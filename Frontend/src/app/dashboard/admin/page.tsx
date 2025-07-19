"use client"

import { useEffect, useState } from "react"
import axios from "axios"

export default function AdminDashboard() {
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await axios.get("/dashboard/summary", {
          headers: {
            Authorization: `