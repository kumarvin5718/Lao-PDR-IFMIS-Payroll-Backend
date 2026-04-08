package com.ifmis.payroll.repository;

import com.ifmis.payroll.entity.master.ProfessionCategory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface ProfessionCategoryRepository extends JpaRepository<ProfessionCategory, UUID> {
    Optional<ProfessionCategory> findByName(String name);
}
