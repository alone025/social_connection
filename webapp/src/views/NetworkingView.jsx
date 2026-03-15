import React from 'react';
import NetworkBrowser from '../components/NetworkBrowser';

const NetworkingView = ({ onBack, accessPhase, onOpenPayment, onViewProfile }) => (
  <NetworkBrowser 
    onBack={onBack} 
    accessPhase={accessPhase} 
    onOpenPayment={onOpenPayment} 
    onViewProfile={onViewProfile}
  />
);

export default NetworkingView;
