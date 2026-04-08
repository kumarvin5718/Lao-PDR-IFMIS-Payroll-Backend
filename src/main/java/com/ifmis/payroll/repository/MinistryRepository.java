package com.ifmis.payroll.repository;

import com.ifmis.payroll.entity.master.Ministry;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface MinistryRepository extends JpaRepository<Ministry, String> {
    Optional<Ministry> findByName(String name);
}
