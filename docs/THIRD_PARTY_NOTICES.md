# Third-Party Notices & Open-Source Attributions

Trivaana AI incorporates design patterns, architectural foundations, and interface references from several open-source projects. This document records their licenses, notices, and usage in accordance with open-source compliance requirements.

---

### 1. Dograh AI
- **Upstream Repository**: https://github.com/dograh-hq/dograh
- **License**: BSD-2-Clause
- **Notice**:
  ```
  Copyright (c) 2024, Dograh HQ
  All rights reserved.

  Redistribution and use in source and binary forms, with or without
  modification, are permitted provided that the following conditions are met:

  1. Redistributions of source code must retain the above copyright notice, this
     list of conditions and the following disclaimer.

  2. Redistributions in binary form must reproduce the above copyright notice,
     this list of conditions and the following disclaimer in the documentation
     and/or other materials provided with the distribution.
  ```
- **Usage**: Evaluated as the primary telephony platform reference. Campaign lifecycle, call status state machine, and telephony configuration concepts adapted into Trivaana's modular backend services.

---

### 2. Pipecat
- **Upstream Repository**: https://github.com/pipecat-ai/pipecat and https://github.com/pipecat-ai/pipecat-examples
- **License**: BSD-2-Clause
- **Notice**:
  ```
  Copyright (c) 2024, Daily
  All rights reserved.
  ```
- **Usage**: Telephony media stream integration and Exotel carrier integration patterns (`pipecat-examples/exotel-chatbot`) adapted for Trivaana's Indian telephony adapter.

---

### 3. Patter
- **Upstream Repository**: https://github.com/PatterAI/Patter
- **License**: MIT
- **Notice**:
  ```
  Copyright (c) 2024 Patter AI
  ```
- **Usage**: Reference for lifecycle callbacks, guardrails, and cost/latency instrumentation.

---

### 4. shadcn/ui & Radix UI
- **Upstream Repository**: https://github.com/shadcn-ui/ui
- **License**: MIT
- **Notice**:
  ```
  Copyright (c) 2023 shadcn
  ```
- **Usage**: UI component structures, accessible dialogs, forms, and tailwind styling patterns.

---

### 5. TanStack Table
- **Upstream Repository**: https://github.com/TanStack/table
- **License**: MIT
- **Notice**:
  ```
  Copyright (c) 2020 Tanner Linsley
  ```
- **Usage**: Contact table and transaction ledger sorting, filtering, and pagination design.

---

### 6. React Bits
- **Upstream Repository**: https://github.com/DavidHDev/react-bits
- **License**: MIT with Commons Clause
- **Usage**: Selected UI interactive animations (CountUp, Magnet, SpotlightCard) in `frontend/src/components/reactbits/`.
