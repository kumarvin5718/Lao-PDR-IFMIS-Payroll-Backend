package com.ifmis.payroll.repository;

import com.ifmis.payroll.entity.master.EducationLevel;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface EducationLevelRepository extends JpaRepository<EducationLevel, UUID> {
    Optional<EducationLevel> findByNameIgnoreCase(String name);
}