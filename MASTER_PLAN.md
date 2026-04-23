# Census Training Portal - Master Plan

This document tracks the core rules and logic of the Census Training Portal to ensure consistency and prevent regressions.

## Core Rules

### 1. Login Defaults
- **Default ID**: The login page defaults to User ID `e001` to facilitate quick access to the "in-progress" training scenario.
- **Normalization**: User IDs are converted to lowercase during login to ensure consistent data retrieval.
- **User-Specific Storage**: All pending records and synced overwrites must be stored in `localStorage` using keys suffixed with the User ID (e.g., `census_pending_records_e001`).
- **Isolation**: User `e001` should not see data from user `e002`, and vice versa.

### 2. Dummy Training Data
- **User e001**: To simulate a progress state, user `e001` is pre-loaded with 15 "Synced" dummy records in the code.
- **User e002**: Starts with 0 records to simulate a fresh training session starting from Building/House `0001`.

### 3. Building Number (Q2) Logic
- **Pre-population**: If no records exist in `localStorage` for the current user, the dropdown must pre-populate buildings `0001` through `0037` (Scenario: Manual work already done).
- **Starting Number**: 
    - For `e001`: Starts after the 15 dummy records + 37 manual records.
    - For `e002`: Starts from `0001` (or `0038` if no records exist).
- **Repeat Logic**: Copies the building number from the most recent record.

### 4. Census House Number (Q3) Logic
- **Sequential Increment**: The "New" button increments the house number from the last record (Synced or Pending).
- **User e001 Starting Point**: Since 15 houses are synced, the next new house will be `0016`.
- **User e002 Starting Point**: Starts from `0001`.

### 3. Line Numbers
- **Start Value**: Sequential numbering now starts at `001` for a fresh start.
- **User e001 Starting Point**: Since 15 entries are already synced, `e001` will start from line `016`.
- **Auto-increment**: Increases by 1 for every new record submitted (Synced + Pending + 1).

### 4. UI/Aesthetics
- **Header**: Must display the current Census House Number in the status bar for all screens after Step 1.
- **Language**: Bilingual support (Hindi/English) with high-fidelity Hindi rendering.
- **Projector Optimization**: High contrast, large fonts, and premium buttons for classroom training.

## Development History & Constraints
- **Training Scenario**: The training assumes 37 houses/buildings have already been documented in the manual process, hence the pre-population starting at 0038.
- **Instruction Fidelity**: All Hindi labels and alerts must match the provided training screenshots exactly.
