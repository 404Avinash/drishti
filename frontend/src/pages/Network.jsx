import React from 'react'
import indianRailwayZones from '../assets/indian_railway_zones.svg'

export default function Network() {
  return (
    <div style={{ 
      width: '100vw', 
      height: '100vh', 
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      background: '#e0e0e0', // match the grayish background of the map
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <img 
        src={indianRailwayZones} 
        alt="Indian Railway Zones"
        style={{ 
          maxWidth: '100%', 
          maxHeight: '100%',
          objectFit: 'contain'
        }}
      />
    </div>
  )
}

